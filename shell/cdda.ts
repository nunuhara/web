// Copyright (c) 2017 Kichikuou <KichikuouChrome@gmail.com>
// This source code is governed by the MIT License, see the LICENSE file.

/// <reference path="util.ts" />
/// <reference path="volume.ts" />
/// <reference path="cddacache.ts" />

namespace xsystem35 {
    export class CDPlayer {
        private cddaCache: CDDACache;
        private audio = <HTMLAudioElement>$('audio');
        private currentTrack: number;
        private isVolumeSupported: boolean;
        private unmute: () => void;  // Non-null if emulating mute by pause

        constructor(loader: Loader, volumeControl: VolumeControl) {
            // Volume control of <audio> is not supported in iOS
            this.audio.volume = 0.5;
            this.isVolumeSupported = this.audio.volume !== 1;

            this.cddaCache = this.isVolumeSupported ? new BasicCDDACache(loader) : new IOSCDDACache(loader);

            volumeControl.addEventListener(this.onVolumeChanged.bind(this));
            this.audio.volume = volumeControl.volume();
            this.audio.addEventListener('error', this.onAudioError.bind(this));
            this.removeUserGestureRestriction(true);
            if (!this.isVolumeSupported) {
                volumeControl.hideSlider();
                if (this.audio.volume === 0)
                    this.unmute = () => {};
            }
        }

        play(track: number, loop: number) {
            this.currentTrack = track;
            if (this.unmute) {
                this.unmute = () => { this.play(track, loop); };
                return;
            }
            this.audio.currentTime = 0;
            this.cddaCache.getCDDA(track).then((blob) => {
                if (blob) {
                    this.startPlayback(blob, loop);
                } else {
                    ga('send', 'event', 'CDDA', 'InvalidTrack');
                }
            });
        }

        stop() {
            this.audio.pause();
            this.currentTrack = null;
            if (this.unmute)
                this.unmute = () => {};
        }

        getPosition(): number {
            if (!this.currentTrack)
                return 0;
            let time = Math.round(this.audio.currentTime * 75);
            if (this.unmute || this.audio.error)
                time += 750;  // unblock Kichikuou OP
            return this.currentTrack | time << 8;
        }

        private startPlayback(blob: Blob, loop: number) {
            this.audio.setAttribute('src', URL.createObjectURL(blob));
            this.audio.loop = (loop !== 0);
            this.audio.load();
            let p: any = this.audio.play();  // Edge returns undefined
            if (p instanceof Promise) {
                p.catch((err) => {
                    if (err.message.startsWith('The play() request was interrupted') ||  // Chrome
                        err.name === 'AbortError') {  // Safari
                        // These errors are harmless, do nothing
                    } else if (err.name === 'NotAllowedError' || err.message.indexOf('gesture') >= 0) {
                        // Audio still locked?
                        this.removeUserGestureRestriction(false);
                        ga('send', 'event', 'CDDA', 'UnlockAgain');
                    } else {
                        let {name, message} = err;
                        gaException({type: 'CDDA', name, message});
                    }
                });
            }
        }

        private onVolumeChanged(evt: CustomEvent) {
            if (this.isVolumeSupported) {
                this.audio.volume = evt.detail;
                return;
            }
            let muted = evt.detail === 0;
            if (!!this.unmute === muted)
                return;
            if (muted) {
                this.audio.pause();
                this.unmute = () => { this.audio.play(); };
            } else {
                let unmute = this.unmute;
                this.unmute = null;
                unmute();
            }
        }

        private onAudioError(err: ErrorEvent) {
            let {code, message} = this.audio.error;
            gaException({type: 'Audio', code, message});
        }

        private removeUserGestureRestriction(firstTime: boolean) {
            let hanlder = () => {
                if (!firstTime) {
                    this.audio.play();
                } else if (!this.currentTrack) {
                    this.audio.load();
                    console.log('CDDA unlocked');
                }
                window.removeEventListener('touchend', hanlder);
                window.removeEventListener('mouseup', hanlder);
            };
            window.addEventListener('touchend', hanlder);
            window.addEventListener('mouseup', hanlder);
        }
    }
}
