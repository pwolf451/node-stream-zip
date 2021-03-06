var
    fs = require('fs'),
    path = require('path'),
    StreamZip = require('../node_stream_zip.js');

var
    testPathTmp,
    testNum = 0,
    basePathTmp = 'test/.tmp/',
    contentPath = 'test/content/';

function testFileOk(file, test) {
    var expEntriesCount = 10,
        expEntriesCountInDocDir = 4;
    if (file === 'osx.zip') {
        expEntriesCount = 25;
        expEntriesCountInDocDir = 5;
    } else if (file === 'windows.zip') {
        expEntriesCount = 8;
    }
    test.expect(23);
    var zip = new StreamZip({ file: 'test/ok/' + file });
    zip.on('ready', function() {
        test.equal(zip.entriesCount, expEntriesCount);
        var entries = zip.entries();

        var containsAll = ['BSDmakefile', 'README.md', 'doc/api_assets/logo.svg',
            'doc/api_assets/sh.css', 'doc/changelog-foot.html', 'doc/sh_javascript.min.js'
        ].every(function(expFile) { return entries[expFile]; });
        test.ok(containsAll);

        test.ok(!zip.entry('not-existing-file'));

        var entry = zip.entry('BSDmakefile');
        test.ok(entry);
        test.ok(!entry.isDirectory);
        test.ok(entry.isFile);

        var dirEntry = zip.entry('doc/');
        var dirShouldExist = file !== 'windows.zip'; // windows archives can contain not all directories
        test.ok(!dirShouldExist || dirEntry);
        test.ok(!dirShouldExist || dirEntry.isDirectory);
        test.ok(!dirShouldExist || !dirEntry.isFile);

        var filePromise = new Promise(function(resolve) {
            zip.extract('README.md', testPathTmp + 'README.md', function(err, res) {
                test.equal(err, null);
                test.ok(1, res);
                assertFilesEqual(test, contentPath + 'README.md', testPathTmp + 'README.md');
                resolve();
            });
        });
        var fileToFolderPromise = new Promise(function(resolve) {
            zip.extract('README.md', testPathTmp, function(err, res) {
                test.equal(err, null);
                test.ok(1, res);
                assertFilesEqual(test, contentPath + 'README.md', testPathTmp + 'README.md');
                resolve();
            });
        });
        var folderPromise = new Promise(function(resolve) {
            zip.extract('doc/', testPathTmp, function(err, res) {
                test.equal(err, null);
                test.equal(res, expEntriesCountInDocDir);
                assertFilesEqual(test, contentPath + 'doc/api_assets/sh.css', testPathTmp + 'api_assets/sh.css');
                resolve();
            });
        });
        var extractAllPromise = new Promise(function(resolve) {
            zip.extract(null, testPathTmp, function(err, res) {
                test.equal(err, null);
                test.ok(7, res);
                assertFilesEqual(test, contentPath + 'doc/api_assets/sh.css', testPathTmp + 'doc/api_assets/sh.css');
                assertFilesEqual(test, contentPath + 'BSDmakefile', testPathTmp + 'BSDmakefile');
                resolve();
            });
        });
        var actualEentryData = zip.entryDataSync('README.md');
        var expectedEntryData = fs.readFileSync(contentPath + 'README.md');
        assertBuffersEqual(test, actualEentryData, expectedEntryData, 'sync entry');

        Promise.all([filePromise, fileToFolderPromise, folderPromise, extractAllPromise]).then(function() {
            test.done();
        });
    });
}

function assertFilesEqual(test, actual, expected) {
    assertBuffersEqual(test, fs.readFileSync(actual), fs.readFileSync(expected), actual + ' <> ' + expected);
}

function assertBuffersEqual(test, actual, expected, str) {
    var actualData = actual.toString('utf8').replace(/\r\n/g, '\n'),
        expectedData = expected.toString('utf8').replace(/\r\n/g, '\n');
    test.equal(actualData, expectedData, str);
}

function rmdirSync(dir) {
    var list = fs.readdirSync(dir);
    for (var i = 0; i < list.length; i++) {
        var filename = path.join(dir, list[i]);
        var stat = fs.statSync(filename);

        if (filename == "." || filename == "..") {
        } else if(stat.isDirectory()) {
            rmdirSync(filename);
        } else {
            try { fs.unlinkSync(filename); } catch (e) {}
        }
    }
    try { fs.rmdirSync(dir); } catch (e) {}
}

module.exports.ok = {};
var filesOk = fs.readdirSync('test/ok');
filesOk.forEach(function(file) {
    module.exports.ok[file] = testFileOk.bind(null, file);
});

module.exports.ok['tiny.zip'] = function(test) {
    test.expect(1);
    var zip = new StreamZip({ file: 'test/special/tiny.zip' });
    zip.on('ready', function() {
        var actualEentryData = zip.entryDataSync('BSDmakefile').toString('utf8');
        test.equal(actualEentryData.substr(0, 4), 'all:');
        test.done();
    });
};

module.exports.ok['zip64.zip'] = function(test) {
    test.expect(1);
    var zip = new StreamZip({ file: 'test/special/zip64.zip' });
    zip.on('ready', function() {
        var internalZip = zip.entryDataSync('files.zip');
        var filesZipTmp = basePathTmp + 'files.zip';
        fs.writeFileSync(filesZipTmp, internalZip);
        var filesZip = new StreamZip({ file: filesZipTmp, storeEntries: true });
        filesZip.on('ready', function() {
            test.equal(66667, filesZip.entriesCount);
            test.done();
        });
    });
};

module.exports.ok['openEntry'] = function(test) {
    test.expect(3);
    var zip = new StreamZip({ file: 'test/ok/normal.zip' });
    zip.on('ready', function () {
        var entries = zip.entries();
        var entry = entries['doc/changelog-foot.html'];
        test.ok(entry);
        var entryBeforeOpen = Object.assign({}, entry);
        zip.openEntry(entry, (err, entryAfterOpen) => {
            test.equal(err, undefined);
            test.notDeepEqual(entryBeforeOpen, entryAfterOpen);
            test.done();
        }, false);
    });
};

module.exports.error = {};
module.exports.error['enc_aes.zip'] = function(test) {
    test.expect(1);
    var zip = new StreamZip({ file: 'test/err/enc_aes.zip' });
    zip.on('ready', function() {
        zip.stream('README.md', function(err) {
            test.equal(err, 'Entry encrypted');
            test.done();
        });
    });
};
module.exports.error['enc_zipcrypto.zip'] = function(test) {
    test.expect(1);
    var zip = new StreamZip({ file: 'test/err/enc_zipcrypto.zip' });
    zip.on('ready', function() {
        zip.stream('README.md', function(err) {
            test.equal(err, 'Entry encrypted');
            test.done();
        });
    });
};
module.exports.error['lzma.zip'] = function(test) {
    test.expect(1);
    var zip = new StreamZip({ file: 'test/err/lzma.zip' });
    zip.on('ready', function() {
        zip.stream('README.md', function(err) {
            test.equal(err, 'Unknown compression method: 14');
            test.done();
        });
    });
};
module.exports.error['rar.rar'] = function(test) {
    test.expect(1);
    var zip = new StreamZip({ file: 'test/err/rar.rar' });
    zip.on('ready', function() {
        test.ok(false, 'Should throw an error');
    });
    zip.on('error', function(err) {
        test.equal(err, 'Bad archive');
        test.done();
    });
};
module.exports.error['corrupt_entry.zip'] = function(test) {
    test.expect(2);
    var zip = new StreamZip({ file: 'test/err/corrupt_entry.zip' });
    zip.on('ready', function() {
        var oneEntry = new Promise(function(resolve) {
            zip.extract('doc/api_assets/logo.svg', testPathTmp, function (err) {
                test.ok(err);
                resolve();
            });
        });
        var allEntries = new Promise(function(resolve) {
            zip.extract('', testPathTmp, function (err) {
                test.ok(err);
                resolve();
            });
        });
        Promise.all([oneEntry, allEntries]).then(function() { test.done(); });
    });
};
module.exports.error['bad_crc.zip'] = function(test) {
    test.expect(2);
    var zip = new StreamZip({ file: 'test/err/bad_crc.zip' });
    zip.on('ready', function() {
        var oneEntry = new Promise(function(resolve) {
            zip.extract('doc/api_assets/logo.svg', testPathTmp, function (err) {
                test.equal(err.message, 'Invalid CRC');
                resolve();
            });
        });
        var allEntries = new Promise(function(resolve) {
            zip.extract('', testPathTmp, function (err) {
                test.ok(err);
                resolve();
            });
        });
        Promise.all([oneEntry, allEntries]).then(function() { test.done(); });
    });
};
module.exports.error['evil.zip'] = function(test) {
    test.expect(2);
    var zip = new StreamZip({ file: 'test/err/evil.zip' });
    zip.on('ready', function() {
        test.ok(false, 'Should throw an error');
    });
    zip.on('error', function(err) {
        var entryName = '..\\..\\..\\..\\..\\..\\..\\..\\file.txt';
        test.equal(err.message, 'Malicious entry: ' + entryName);
        var zip = new StreamZip({ file: 'test/err/evil.zip', skipEntryNameValidation: true });
        zip.on('ready', function() {
            test.ok(zip.entry(entryName), 'Entry exists');
            test.done();
        });
    });
};

module.exports.parallel = {};
module.exports.parallel['streaming 100 files'] = function(test) {
    var num = 100;
    test.expect(num);
    var zip = new StreamZip({ file: 'test/ok/normal.zip' });
    zip.on('ready', function() {
        var extracted = 0;
        var files = ['doc/changelog-foot.html', 'doc/sh_javascript.min.js', 'BSDmakefile', 'README.md'];
        for (var i = 0; i < num; i++) {
            var file = files[Math.floor(Math.random() * files.length)];
            zip.extract(file, testPathTmp + i, function (err) {
                test.equal(err, null);
                if (++extracted === num)
                    test.done();
            });
        }
    });
};

module.exports['callback exception'] = function(test) {
    test.expect(3);
    var zip = new StreamZip({ file: 'test/special/tiny.zip' });
    var streamError = false;
    var streamFinished = false;
    var callbackCallCount = 0;
    zip.once('entry', function(entry) {
        zip.stream(entry, function (err, stream) {
            callbackCallCount++;
            process.once('uncaughtException', function(ex) {
                test.equal(ex.message, 'descriptive message!');
                test.equal(callbackCallCount, 1);
                test.ok(!streamError && !streamFinished);
                test.done();
            });
            stream.on('data', function () {
                throw new Error('descriptive message!');
            });
            stream.on('error', function () {
                streamError = true;
            });
            stream.on('finish', function () {
                streamFinished = true;
            });
            var downstream = new require('stream').PassThrough();
            stream.pipe(downstream);
        });
    });
};

module.exports.setUp = function(done) {
    testPathTmp = basePathTmp + testNum++ + '/';
    if (!fs.existsSync(basePathTmp))
        fs.mkdirSync(basePathTmp);
    if (fs.existsSync(testPathTmp))
        rmdirSync(testPathTmp);
    fs.mkdirSync(testPathTmp);
    done();
};
module.exports.tearDown = function(done) {
    done();
};

process.on('exit', function() {
    rmdirSync(basePathTmp);
});