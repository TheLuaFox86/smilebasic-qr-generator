
function generateQRCodeClicked() {
    let programName = document.getElementById('name').value;
    let source = document.getElementById('source').value.replace(/\n/g, "\r").toUpperCase();
    let dataForQRCode = generateDataForQRCode(programName, source);
    
    document.getElementById('result').value = dataForQRCode;
    
    let qr = qrcode(0, 'H');
    qr.addData(dataForQRCode);
    qr.make();
    document.getElementById('qr').innerHTML = qr.createImgTag(4);

}
file = document.getElementById("file")
file.addEventListener("change", (event) => {
	fr = new FileReader()
	fr.onload = function(e) {
			document.getElementById("source").value = e.target.result
	}
	fr.readAsText(event.target.files[0])
})
function generateDataForQRCode(programName, utfSource) {
    let sjisSource = Encoding.convert(Encoding.stringToCode(utfSource), {
      to: 'SJIS',
      from: 'UNICODE'
    });
    var source = Encoding.codeToString(sjisSource);

    let petcSource = "PETC0300RPRG";
    petcSource += leBytesForNum(0);
    petcSource += leBytesForNum(0);
    petcSource += leBytesForNum(source.length);
    petcSource += source;
    
    let deflate = new Zlib.Deflate(stringToByteArray(petcSource), {
        compressionType: Zlib.Deflate.CompressionType.DYNAMIC
    });
    let petcSourceRawCompressed = deflate.compress();
    let petcSourceCompressed = bytesToString(petcSourceRawCompressed);

    let rprgSource = stringPaddedNull(programName, 8);
    rprgSource += "RPRG";
    rprgSource += leBytesForNum(petcSourceCompressed.length);
    rprgSource += leBytesForNum(petcSource.length);
    rprgSource += petcSourceCompressed;

    let hash = md5(stringToByteArray(rprgSource));

    let partSource = "PT";
    partSource += String.fromCharCode(0x01);
    partSource += String.fromCharCode(0x01);
    partSource += md5HashToBytes(hash);
    partSource += md5HashToBytes(hash);
    partSource += rprgSource;

    return partSource.substring(0, 630);
}

/* Utils */
function numFromLeBytes(str, offset) {
    return (str.charCodeAt(offset) & 0xFF) |
           ((str.charCodeAt(offset + 1) & 0xFF) << 8) |
           ((str.charCodeAt(offset + 2) & 0xFF) << 16) |
           ((str.charCodeAt(offset + 3) & 0xFF) << 24);
}
function decodeQRCodeData(qrData) {
    // 1. Validate Header
    if (!qrData.startsWith("PT")) {
        throw new Error("Invalid format: Missing 'PT' header.");
    }

    // 2. Extract header metadata
    // Format: "PT" + part (1 byte) + totalParts (1 byte) + hash1 (16 bytes) + hash2 (16 bytes)
    let currentPart = qrData.charCodeAt(2);
    let totalParts = qrData.charCodeAt(3);
    let hash1 = qrData.substring(4, 20);
    let hash2 = qrData.substring(20, 36);

    // Payload starts after the 36-byte header
    let rprgPayload = qrData.substring(36);

    // 3. Verify MD5 Hash
    let calculatedHashBytes = md5(stringToByteArray(rprgPayload));
    let calculatedHashRaw = md5HashToBytes(calculatedHashBytes);
    
    if (calculatedHashRaw !== hash1) {
        console.warn("Hash mismatch: The QR code payload might be corrupted or truncated.");
    }

    // 4. Parse RPRG Header
    // Header format: Name (8 bytes null-padded) + "RPRG" (4 bytes) + compressedLen (4 bytes) + rawLen (4 bytes)
    let programName = rprgPayload.substring(0, 8).replace(/\0/g, ''); // Strip null padding
    let magicRprg = rprgPayload.substring(8, 12);

    if (magicRprg !== "RPRG") {
        throw new Error("Invalid format: Missing 'RPRG' magic header.");
    }

    let compressedSize = numFromLeBytes(rprgPayload, 12);
    let uncompressedSize = numFromLeBytes(rprgPayload, 16);

    let compressedDataString = rprgPayload.substring(20, 20 + compressedSize);
    let compressedByteArray = stringToByteArray(compressedDataString);

    // 5. Decompress Zlib payload
    let inflate = new Zlib.Inflate(compressedByteArray);
    let petcByteArray = inflate.decompress();
    let petcDataString = bytesToString(petcByteArray);

    // 6. Parse PETC Header & Extract SJIS String
    // Format: "PETC0300RPRG" (12 bytes) + 0x0 (4 bytes) + 0x0 (4 bytes) + sjisLen (4 bytes)
    let sjisLength = numFromLeBytes(petcDataString, 20);
    let sjisRawString = petcDataString.substring(24, 24 + sjisLength);

    // 7. Convert Shift-JIS back to Unicode text
    let sjisCodeArray = stringToByteArray(sjisRawString);
    let unicodeArray = Encoding.convert(sjisCodeArray, {
        to: 'UNICODE',
        from: 'SJIS'
    });
    let sourceText = Encoding.codeToString(unicodeArray);

    return {
        programName: programName,
        source: sourceText
    };
}

function stringToByteArray(string) {
    let result = [];
    for (let i = 0; i < string.length; i++) {
        result.push(string.charCodeAt(i) & 0xff);
    }
    return result;
}

function md5HashToBytes(hash) {
    let result = '';
    for (let i = 0; i < 16; i++) {
        result += String.fromCharCode(parseInt(hash.substring(i * 2, i * 2 + 2), 16));
    }
    return result;
}

function bytesToString(bytes) {
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
        result += String.fromCharCode(bytes[i] & 0xff);
    }
    return result;
}

function stringPaddedNull(str, len) {
    let result = str;
    while (result.length < len) {
        result += "\0";
    }
    return result;
}

function leBytesForNum(num) {
    return String.fromCharCode(num & 0xFF, 
        (num >> 8) & 0xFF, 
        (num >> 16) & 0xFF, 
        (num >> 24) & 0xFF);
}


function downloadText() {
  // 1. Define your text content
  const textContent = document.getElementById("source").value;
  
  // 2. Create a Blob object with the text and specify the text/plain MIME type
  const blob = new Blob([textContent], { type: "text/plain" });
  
  // 3. Create a temporary invisible anchor link
  const link = document.createElement("a");
  
  // 4. Generate a local URL representing the blob object
  link.href = URL.createObjectURL(blob);
  
  // 5. Specify the default filename for the download
  link.download = document.getElementById("name").value + ".txt";
  
  // 6. Trigger the download automatically
  link.click();
  
  // 7. Clean up the URL object to free up memory
  //URL.revokeObjectURL(link.href);
}
// decode program
function processUploadedQRBytes(rawBytes) {
    try {
        let decodedResult = decodeQRCodeFromBytes(rawBytes);

        if (document.getElementById("name")) {
            document.getElementById("name").value = decodedResult.programName;
        }
        if (document.getElementById("source")) {
            document.getElementById("source").value = decodedResult.source;
        }

        console.log("Successfully unpacked program:", decodedResult.programName);
    } catch (error) {
        console.error("Data processing failed:", error.message);
        alert("Failed to parse PETC QR Code: " + error.message);
    }
}

function decodeDataToPrg(data) {
try {
    let result = decodeQRCodeData(data);
    
    // Display decoded output back in your UI
    document.getElementById("name").value = result.programName;
    document.getElementById("source").value = result.source + "\nDecoded";
    
    console.log("Successfully decoded program:", result.programName);
} catch (error) {
    console.error("Decoding failed:", error.message);
}
}

function decodeQRCodeFromBytes(bytes) {
    // 1. Minimum PETC / PT header check (36 bytes header minimum)
    if (bytes.length < 36) {
        throw new Error("QR Data payload is too short.");
    }

    // 2. Validate "PT" Magic Bytes ([0x50, 0x54])
    if (bytes[0] !== 0x50 || bytes[1] !== 0x54) {
        throw new Error("Invalid format: Missing 'PT' header magic bytes.");
    }

    // Slice off 36-byte header ("PT" + 2 bytes part info + 32 bytes hashes)
    let rprgBytes = bytes.subarray(36);

    // 3. Extract Program Name (First 8 bytes, null padded)
    let programName = "";
    for (let i = 0; i < 8; i++) {
        if (rprgBytes[i] === 0) break;
        programName += String.fromCharCode(rprgBytes[i]);
    }

    // 4. Verify "RPRG" Header (Bytes 8..11 -> [0x52, 0x50, 0x52, 0x47])
    if (rprgBytes[8] !== 0x52 || rprgBytes[9] !== 0x50 || 
        rprgBytes[10] !== 0x52 || rprgBytes[11] !== 0x47) {
        throw new Error("Invalid format: Missing 'RPRG' section.");
    }

    // 5. Read Compressed Size (Little Endian uint32 at offset 12)
    let compressedSize = rprgBytes[12] | 
                        (rprgBytes[13] << 8) | 
                        (rprgBytes[14] << 16) | 
                        (rprgBytes[15] << 24);

    // Compressed payload starts at offset 20
    let compressedData = rprgBytes.subarray(20, 20 + compressedSize);

    // 6. Decompress Zlib payload
    let inflate = new Zlib.Inflate(compressedData);
    let petcBytes = inflate.decompress(); // Returns Uint8Array

    // 7. Extract SJIS length from decompressed PETC header (Offset 20)
    let sjisLength = petcBytes[20] | 
                    (petcBytes[21] << 8) | 
                    (petcBytes[22] << 16) | 
                    (petcBytes[23] << 24);

    // Extract Shift-JIS text bytes (Offset 24)
    let sjisBytes = petcBytes.subarray(24, 24 + sjisLength);

    // 8. Convert Shift-JIS Bytes -> Unicode String
    let unicodeArray = Encoding.convert(Array.from(sjisBytes), {
        to: 'UNICODE',
        from: 'SJIS'
    });
    
    return {
        programName: programName,
        source: Encoding.codeToString(unicodeArray)
    };
}
const qrFileSelector = document.getElementById('qr-file');

if (qrFileSelector) {
    qrFileSelector.addEventListener('change', event => {
        const file = event.target.files[0];
        if (!file) return;

        const img = new Image();
        img.onload = () => {
            // Render image to hidden canvas to extract pixel data
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code && code.binaryData) {
                let rawBytes = new Uint8Array(code.binaryData);
                processUploadedQRBytes(rawBytes);
            } else {
                alert("Could not detect or decode a binary QR code.");
            }
        };
        img.src = URL.createObjectURL(file);
    });
}
