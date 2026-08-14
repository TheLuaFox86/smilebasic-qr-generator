
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
