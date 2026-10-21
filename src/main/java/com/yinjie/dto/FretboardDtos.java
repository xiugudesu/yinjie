package com.yinjie.dto;

import java.util.List;

/** 指板音阶视图的返回结构。 */
public final class FretboardDtos {

    private FretboardDtos() {
    }

    public record FretboardResponse(String rootName,
                                    int rootPitchClass,
                                    String accidental,
                                    ScaleView scale,
                                    List<OptionsDtos.TuningString> strings,
                                    List<Integer> frets,
                                    List<Cell> cells) {
    }

    public record ScaleView(String id,
                            String name,
                            String english,
                            String category,
                            List<String> formula,
                            List<Integer> intervals,
                            List<ScaleNote> notes) {
    }

    public record ScaleNote(String name, int pitchClass, int degree, String degreeLabel, String intervalName) {
    }

    public record Cell(int string,
                       int fret,
                       int midi,
                       int pitchClass,
                       String noteName,
                       String degreeLabel,
                       String chromaticLabel,
                       boolean inScale,
                       boolean isRoot,
                       int intervalFromRoot) {
    }
}
