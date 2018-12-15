// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

let $: (selector: string) => HTMLElement = document.querySelector.bind(document);

function readFileAsArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => { resolve(reader.result as ArrayBuffer); };
        reader.onerror = () => { reject(reader.error); };
        reader.readAsArrayBuffer(blob);
    });
}

function readFileAsText(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => { resolve(reader.result as string); };
        reader.onerror = () => { reject(reader.error); };
        reader.readAsText(blob);
    });
}

function ASCIIArrayToString(buffer: Uint8Array): string {
    return String.fromCharCode.apply(null, buffer);
}

function SJISArrayToString(buffer: DataView): string {
    if (typeof TextDecoder !== 'undefined')
        return new TextDecoder('shift_jis').decode(buffer);

    let out = [];
    for (let i = 0; i < buffer.byteLength; i++) {
        let c = buffer.getUint8(i);
        if (c >= 0xa0 && c <= 0xdf)
            out.push(0xff60 + c - 0xa0);
        else if (c < 0x80)
            out.push(c);
        else {
            try {  // Emscripten module may not be loaded yet
                out.push(_sjis2unicode(c, buffer.getUint8(++i)));
            } catch (err) {}
        }
    }
    return String.fromCharCode.apply(null, out);
}

function openFileInput(): Promise<File> {
    return new Promise((resolve) => {
        let input = document.createElement('input');
        input.type = 'file';
        input.addEventListener('change', (evt: Event) => {
            document.body.removeChild(input);
            resolve(input.files[0]);
        });
        input.style.display = 'none';
        document.body.appendChild(input);
        input.click();
    });
}

function mkdirIfNotExist(path: string, fs?: typeof FS) {
    try {
        (fs || FS).mkdir(path);
    } catch (err) {
        if (<any>err.code !== 'EEXIST')
            throw err;
    }
}

function isIOSVersionBetween(from: string, to: string): boolean {
    let match = navigator.userAgent.match(/OS ([0-9_]+) like Mac OS X\)/);
    if (!match)
        return false;
    let ver = match[1].replace(/_/g, '.');
    return from <= ver && ver < to;
}

function gaException(description: any, exFatal: boolean = false) {
    let exDescription = JSON.stringify(description, (_, value) => {
        if (value instanceof DOMException) {
            return {DOMException: value.name, message: value.message};
        }
        return value;
    });
    ga('send', 'exception', {exDescription, exFatal});
}

// xsystem35 exported functions
declare function _ags_setAntialiasedStringMode(on: number): void;
declare function _ald_getdata(type: number, no: number): number;
declare function _ald_freedata(data: number): void;
declare function _sjis2unicode(byte1: number, byte2: number): void;
declare function _sdl_getDisplaySurface(): number;

declare namespace Module {
    // Undocumented methods / attributes
    let canvas: HTMLCanvasElement;
    function getMemory(size: number): number;
    function setStatus(status: string): void;
    function setWindowTitle(title: string): void;
    function quit(status: number, toThrow: Error): void;
}

declare namespace FS {
    function readFile(path: string, opts?: {encoding?: string; flags?: string}): any;
    function writeFile(path: string, data: ArrayBufferView | string,
                       opts?: {encoding?: string; flags?: string; canOwn?: boolean}): void;
}

declare namespace EmterpreterAsync {
    function handle(asyncOp: (resume: () => void) => void): void;
}

// https://storage.spec.whatwg.org
interface Navigator {
    storage: StorageManager;
}
interface StorageManager {
    persisted: () => Promise<boolean>;
    persist: () => Promise<boolean>;
    // estimate: () => Promise<StorageEstimate>;
}
