// Copyright (c) 2017, Compiler Explorer Authors
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright notice,
//       this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

import {unwrap} from '../lib/assert.js';
import {MapFileReaderDelphi} from '../lib/mapfiles/map-file-delphi.js';
import {MapFileReaderVS} from '../lib/mapfiles/map-file-vs.js';

import {chai} from './utils.js';

const expect = chai.expect;

describe('Map setup', function () {
    it('VS-map preferred load address', function () {
        const reader = new MapFileReaderVS('');
        reader.preferredLoadAddress.should.equal(0x400000, 'default load address');

        reader.tryReadingPreferredAddress(' Preferred load address is 00400000');
        reader.preferredLoadAddress.should.equal(0x400000);

        reader.tryReadingPreferredAddress(' Preferred load address is 00410000');
        reader.preferredLoadAddress.should.equal(0x410000);
    });
});

describe('Code Segments', function () {
    it('One normal Delphi-Map segment', function () {
        const reader = new MapFileReaderDelphi('');
        reader.tryReadingCodeSegmentInfo(' 0001:00002838 00000080 C=CODE     S=.text    G=(none)   M=output   ACBP=A9');
        reader.segments.length.should.equal(1);

        let info = reader.getSegmentInfoByStartingAddress('0001', 0x2838);
        expect(unwrap(info).unitName).to.equal('output.pas');

        info = reader.getSegmentInfoByStartingAddress(undefined, reader.getSegmentOffset('0001') + 0x2838);
        expect(unwrap(info).unitName).to.equal('output.pas');

        info = reader.getSegmentInfoByStartingAddress('0001', 0x1234);
        expect(info, 'Address should not be a Start for any segment').to.be.undefined;

        info = reader.getSegmentInfoAddressIsIn('0001', 0x2838 + 0x10);
        expect(unwrap(info).unitName).to.equal('output.pas');

        info = reader.getSegmentInfoAddressIsIn(undefined, reader.getSegmentOffset('0001') + 0x2838 + 0x10);
        expect(unwrap(info).unitName).to.equal('output.pas');

        info = reader.getSegmentInfoAddressIsIn('0001', reader.getSegmentOffset('0001') + 0x2838 + 0x80 + 1);
        expect(info, 'Address should not be in any segment').to.be.undefined;

        info = reader.getSegmentInfoByUnitName('output.pas');
        expect(unwrap(info).unitName).to.equal('output.pas');
        unwrap(info).addressInt.should.equal(reader.getSegmentOffset('0001') + 0x2838);
    });

    it('Not include this segment', function () {
        const reader = new MapFileReaderDelphi('');
        reader.tryReadingCodeSegmentInfo(' 0002:000000B0 00000023 C=ICODE    S=.itext   G=(none)   M=output   ACBP=A9');
        reader.segments.length.should.equal(0);
    });

    it('ICode/IText segments', function () {
        const reader = new MapFileReaderDelphi('');
        reader.tryReadingCodeSegmentInfo(' 0002:000000B0 00000023 C=ICODE    S=.itext   G=(none)   M=output   ACBP=A9');
        reader.isegments.length.should.equal(1);
    });

    it('One normal VS-Map segment', function () {
        const reader = new MapFileReaderVS('');
        reader.tryReadingCodeSegmentInfo(' 0001:00002838 00000080H .text$mn                CODE');
        reader.segments.length.should.equal(1);

        let info = reader.getSegmentInfoByStartingAddress('0001', 0x2838);
        unwrap(info).addressInt.should.equal(reader.getSegmentOffset('0001') + 0x2838);

        info = reader.getSegmentInfoByStartingAddress(undefined, 0x403838);
        unwrap(info).addressInt.should.equal(reader.getSegmentOffset('0001') + 0x2838);

        info = reader.getSegmentInfoAddressIsIn(undefined, reader.getSegmentOffset('0001') + 0x2838 + 0x10);
        unwrap(info).addressInt.should.equal(reader.getSegmentOffset('0001') + 0x2838);

        info = reader.getSegmentInfoAddressIsIn('0001', reader.getSegmentOffset('0001') + 0x2837);
        expect(info).to.be.undefined;
    });

    it('Repair VS-Map code segment info', function () {
        const reader = new MapFileReaderVS('');
        reader.tryReadingCodeSegmentInfo(' 0002:00000000 00004c73H .text$mn                CODE');
        reader.tryReadingNamedAddress(
            ' 0002:000007f0       _main                      004117f0 f   ConsoleApplication1.obj',
        );

        let info = reader.getSegmentInfoByStartingAddress('0002', 0);
        expect(unwrap(info).unitName).to.equal('ConsoleApplication1.obj');

        reader.getSegmentOffset('0002').should.equal(0x411000);

        info = reader.getSegmentInfoByStartingAddress(undefined, 0x411000);
        expect(unwrap(info).unitName).to.equal('ConsoleApplication1.obj');
    });
});

describe('Symbol info', function () {
    it('Delphi-Map symbol test', function () {
        const reader = new MapFileReaderDelphi('');
        reader.tryReadingNamedAddress(' 0001:00002838       Square');
        reader.namedAddresses.length.should.equal(1);

        let info = reader.getSymbolAt('0001', 0x2838);
        expect(info).to.not.equal(undefined, 'Symbol Square should have been returned 1');
        expect(unwrap(info).displayName).to.equal('Square');

        info = reader.getSymbolAt(undefined, reader.getSegmentOffset('0001') + 0x2838);
        expect(info).to.not.equal(undefined, 'Symbol Square should have been returned 2');
        expect(unwrap(info).displayName).to.equal('Square');
    });

    it('Delphi-Map D2009 symbol test', function () {
        const reader = new MapFileReaderDelphi('');
        reader.tryReadingNamedAddress(' 0001:00002C4C       output.MaxArray');
        reader.namedAddresses.length.should.equal(1);

        let info = reader.getSymbolAt('0001', 0x2c4c);
        expect(info).to.not.equal(undefined, 'Symbol MaxArray should have been returned');
        expect(unwrap(info).displayName).to.equal('output.MaxArray');

        //todo should not be undefined
        info = reader.getSymbolAt(undefined, reader.getSegmentOffset('0001') + 0x2c4c);
        expect(info).to.not.equal(undefined, 'Symbol MaxArray should have been returned');
        expect(unwrap(info).displayName).to.equal('output.MaxArray');
    });

    it('VS-Map symbol test', function () {
        const reader = new MapFileReaderVS('');
        reader.tryReadingNamedAddress(
            ' 0002:000006b0       ??$__vcrt_va_start_verify_argument_type@QBD@@YAXXZ 004116b0 f i ConsoleApplication1.obj',
        );
        reader.namedAddresses.length.should.equal(1);

        let info = reader.getSymbolAt('0002', 0x6b0);
        expect(info).to.not.equal(undefined, 'Symbol start_verify_argument should have been returned 1');
        expect(unwrap(info).displayName).to.equal('??$__vcrt_va_start_verify_argument_type@QBD@@YAXXZ');

        info = reader.getSymbolAt(undefined, 0x4116b0);
        expect(info).to.not.equal(undefined, 'Symbol start_verify_argument should have been returned 2');
        expect(unwrap(info).displayName).to.equal('??$__vcrt_va_start_verify_argument_type@QBD@@YAXXZ');
    });

    it('Delphi-Map Duplication prevention', function () {
        const reader = new MapFileReaderDelphi('');
        reader.tryReadingNamedAddress(' 0001:00002838       Square');
        reader.namedAddresses.length.should.equal(1);

        reader.tryReadingNamedAddress(' 0001:00002838       Square');
        reader.namedAddresses.length.should.equal(1);
    });
});

describe('Delphi-Map Line number info', function () {
    it('No line', function () {
        const reader = new MapFileReaderDelphi('');
        reader.tryReadingLineNumbers('').should.equal(false);
    });

    it('One line', function () {
        const reader = new MapFileReaderDelphi('');
        reader.tryReadingLineNumbers('    17 0001:000028A4').should.equal(true);

        let lineInfo = reader.getLineInfoByAddress('0001', 0x28a4);
        expect(unwrap(lineInfo).lineNumber).to.equal(17);

        lineInfo = reader.getLineInfoByAddress(undefined, reader.getSegmentOffset('0001') + 0x28a4);
        expect(unwrap(lineInfo).lineNumber).to.equal(17);
    });

    it('Multiple lines', function () {
        const reader = new MapFileReaderDelphi('');
        reader
            .tryReadingLineNumbers('    12 0001:00002838    13 0001:0000283B    14 0001:00002854    15 0001:00002858')
            .should.equal(true);

        let lineInfo = reader.getLineInfoByAddress('0001', 0x2838);
        expect(unwrap(lineInfo).lineNumber).to.equal(12);

        lineInfo = reader.getLineInfoByAddress('0001', 0x2858);
        expect(unwrap(lineInfo).lineNumber).to.equal(15);

        lineInfo = reader.getLineInfoByAddress('0001', 0x2854);
        expect(unwrap(lineInfo).lineNumber).to.equal(14);

        lineInfo = reader.getLineInfoByAddress('0001', 0x283b);
        expect(unwrap(lineInfo).lineNumber).to.equal(13);
    });
});

describe('Delphi-Map load test', function () {
    it('Minimal map', function () {
        const reader = new MapFileReaderDelphi('test/maps/minimal-delphi.map');
        reader.run();

        reader.segments.length.should.equal(4);
        reader.lineNumbers.length.should.equal(7);
        reader.namedAddresses.length.should.equal(11);

        let info = reader.getSegmentInfoByUnitName('output.pas');
        unwrap(info).addressInt.should.equal(reader.getSegmentOffset('0001') + 0x2c4c);

        info = reader.getICodeSegmentInfoByUnitName('output.pas');
        unwrap(info).segment.should.equal('0002');
        unwrap(info).addressWithoutOffset.should.equal(0xb0);
        unwrap(info).addressInt.should.equal(0x4040b0);
    });
});

describe('VS-Map load test', function () {
    it('Minimal map', function () {
        const reader = new MapFileReaderVS('test/maps/minimal-vs15.map');
        reader.run();

        reader.segments.length.should.equal(1);
        unwrap(reader.getSegmentInfoByUnitName('ConsoleApplication1.obj')).addressInt.should.equal(0x411000);

        reader.getSegmentOffset('0001').should.equal(0x401000, 'offset 1');
        reader.getSegmentOffset('0002').should.equal(0x411000, 'offset 2');
        reader.getSegmentOffset('0003').should.equal(0x416000, 'offset 3');
        reader.getSegmentOffset('0004').should.equal(0x419000, 'offset 4');
        reader.getSegmentOffset('0005').should.equal(0x41a000, 'offset 5');
        reader.getSegmentOffset('0007').should.equal(0x41c000, 'offset 7');
    });
});

describe('VS-Map address checking', function () {
    it('Normal defined spaces', function () {
        const reader = new MapFileReaderVS('');

        const mainAddresses = [
            {startAddress: 1, startAddressHex: '00000001', endAddress: 10, endAddressHex: '0000000A'},
            {startAddress: 16, startAddressHex: '00000010', endAddress: 255, endAddressHex: '000000FF'},
        ];

        reader.isWithinAddressSpace(mainAddresses, 3, 5).should.equal(true);
        reader.isWithinAddressSpace(mainAddresses, 10, 5).should.equal(false);
        reader.isWithinAddressSpace(mainAddresses, 11, 4).should.equal(false);
        reader.isWithinAddressSpace(mainAddresses, 16, 10).should.equal(true);
        reader.isWithinAddressSpace(mainAddresses, 32, 10).should.equal(true);
    });

    it('Overlapping regions', function () {
        const reader = new MapFileReaderVS('');

        const mainAddresses = [
            {startAddress: 1, startAddressHex: '00000001', endAddress: 10, endAddressHex: '0000000A'},
            {startAddress: 16, startAddressHex: '00000010', endAddress: 255, endAddressHex: '000000FF'},
        ];

        reader.isWithinAddressSpace(mainAddresses, 0, 5).should.equal(true);
        reader.isWithinAddressSpace(mainAddresses, 11, 5).should.equal(true);
        reader.isWithinAddressSpace(mainAddresses, 11, 6).should.equal(true);
        reader.isWithinAddressSpace(mainAddresses, 11, 258).should.equal(true);
    });
});
