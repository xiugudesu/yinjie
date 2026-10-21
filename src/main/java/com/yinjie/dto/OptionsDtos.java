package com.yinjie.dto;

import java.util.List;

/** 前端初始化所需的静态选项数据。 */
public final class OptionsDtos {

    private OptionsDtos() {
    }

    public record OptionsResponse(String appName,
                                  String productName,
                                  List<RootOption> roots,
                                  List<ScaleOption> scales,
                                  List<TuningOption> tunings,
                                  String defaultTuning,
                                  FretRange fretRange,
                                  Defaults defaults) {
    }

    public record RootOption(String name, int pitchClass, String accidental) {
    }

    public record ScaleOption(String id,
                              String name,
                              String english,
                              String category,
                              List<String> formula,
                              List<Integer> intervals) {
    }

    /** 调弦预设：tuningParam 可直接作为 /api/fretboard、/api/caged、/api/chord/identify 的 tuning 参数。 */
    public record TuningOption(String id,
                               String name,
                               String english,
                               String tuningParam,
                               int stringCount,
                               List<TuningString> strings) {
    }

    public record TuningString(int index, int number, String openName, int openMidi, int openPitchClass) {
    }

    public record FretRange(int min, int max) {
    }

    public record Defaults(String rootName,
                           String scaleId,
                           int fretFrom,
                           int fretTo,
                           String accidental) {
    }
}
