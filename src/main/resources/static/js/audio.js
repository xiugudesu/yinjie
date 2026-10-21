/* ==========================================================================
   yinjie · 音阶指板工坊 — WebAudio pluck synthesis
   No samples, no external libraries. The AudioContext is created lazily and
   only ever from a user gesture (pointer / keyboard handler).
   ========================================================================== */
(function () {
  "use strict";

  var ctx = null;
  var master = null;
  var enabled = true;
  var MAX_GAIN = 0.85;

  function midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function ensureContext() {
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume().catch(function () {});
      }
      return ctx;
    }
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) {
      return null;
    }
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = enabled ? MAX_GAIN : 0;
      master.connect(ctx.destination);
    } catch (error) {
      ctx = null;
      master = null;
      return null;
    }
    return ctx;
  }

  function currentTime() {
    var audio = ensureContext();
    return audio ? audio.currentTime : 0;
  }

  /**
   * One plucked electric-guitar note: triangle body + detuned saw shimmer through
   * an exponentially closing low-pass, with a fast attack / long decay envelope.
   */
  function pluck(midi, options) {
    if (!enabled) {
      return;
    }
    var audio = ensureContext();
    if (!audio) {
      return;
    }
    var opts = options || {};
    var delay = typeof opts.delay === "number" ? opts.delay : 0;
    var duration = typeof opts.duration === "number" ? opts.duration : 1.7;
    var velocity = typeof opts.velocity === "number" ? opts.velocity : 0.44;
    var frequency = midiToFrequency(midi);
    var start = audio.currentTime + Math.max(delay, 0);

    var amp = audio.createGain();
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(Math.min(0.9, velocity), start + 0.009);
    amp.gain.exponentialRampToValueAtTime(Math.min(0.28, velocity * 0.55), start + 0.16);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    var filter = audio.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(Math.min(9500, Math.max(1900, frequency * 9)), start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(220, frequency * 1.15), start + duration * 0.85);

    var body = audio.createOscillator();
    body.type = "triangle";
    body.frequency.setValueAtTime(frequency, start);

    var shimmer = audio.createOscillator();
    shimmer.type = "sawtooth";
    shimmer.frequency.setValueAtTime(frequency * 2.003, start);
    shimmer.detune.setValueAtTime(4, start);

    var shimmerGain = audio.createGain();
    shimmerGain.gain.setValueAtTime(0.16, start);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, start + Math.min(duration * 0.55, 1.1));

    var sub = audio.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(frequency / 2, start);
    var subGain = audio.createGain();
    subGain.gain.setValueAtTime(0.09, start);
    subGain.gain.exponentialRampToValueAtTime(0.0001, start + duration * 0.5);

    body.connect(filter);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(filter);
    sub.connect(subGain);
    subGain.connect(filter);
    filter.connect(amp);
    amp.connect(master);

    body.start(start);
    shimmer.start(start);
    sub.start(start);
    body.stop(start + duration + 0.05);
    shimmer.stop(start + duration + 0.05);
    sub.stop(start + duration + 0.05);
  }

  /** A soft strum across the given MIDI notes (ascending by pitch). */
  function strum(midis, options) {
    if (!enabled || !midis || !midis.length) {
      return;
    }
    var opts = options || {};
    var sorted = midis.slice().sort(function (a, b) {
      return a - b;
    });
    var spread = typeof opts.spread === "number" ? opts.spread : 0.026;
    for (var index = 0; index < sorted.length; index += 1) {
      pluck(sorted[index], {
        delay: index * spread,
        velocity: (opts.velocity || 0.3) * (0.85 + 0.15 * Math.random()),
        duration: opts.duration || 2.0
      });
    }
  }

  function setEnabled(value) {
    enabled = !!value;
    if (master && ctx) {
      var now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(enabled ? MAX_GAIN : 0, now, 0.02);
    }
  }

  function isEnabled() {
    return enabled;
  }

  window.FretAudio = {
    ensureContext: ensureContext,
    pluck: pluck,
    strum: strum,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    get currentTime() {
      return currentTime();
    }
  };
})();
