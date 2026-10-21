package com.yinjie.theory;

import java.util.List;

/**
 * 内置调弦预设。每个预设都带有一个规范的 {@code tuning} 参数串，前端可以直接回传给 API。
 */
public final class TuningCatalog {

    /** 一个调弦预设。 */
    public record Preset(String id, String name, String english, String tuningParam, Tuning tuning) {
    }

    private static final List<Preset> PRESETS = List.of(
            preset("standard", "标准调弦", "Standard (E-A-D-G-B-E)", "E2,A2,D3,G3,B3,E4"),
            preset("drop-d", "Drop D 调弦", "Drop D", "D2,A2,D3,G3,B3,E4"),
            preset("half-step-down", "降半音调弦", "Half Step Down (Eb)", "Eb2,Ab2,Db3,Gb3,Bb3,Eb4"),
            preset("dadgad", "DADGAD 调弦", "DADGAD", "D2,A2,D3,G3,A3,D4"),
            preset("open-g", "Open G 调弦", "Open G", "D2,G2,D3,G3,B3,D4"),
            preset("open-d", "Open D 调弦", "Open D", "D2,A2,D3,F#3,A3,D4")
    );

    public static final String DEFAULT_ID = "standard";

    private TuningCatalog() {
    }

    private static Preset preset(String id, String name, String english, String tuningParam) {
        return new Preset(id, name, english, tuningParam, Tuning.parse(tuningParam));
    }

    public static List<Preset> all() {
        return PRESETS;
    }

    public static Preset defaultPreset() {
        return PRESETS.get(0);
    }

    public static Preset byId(String id) {
        return PRESETS.stream().filter(p -> p.id().equals(id)).findFirst().orElse(null);
    }
}
