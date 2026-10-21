package com.yinjie.dto;

import java.util.List;

/** CAGED 系统指板图的返回结构。 */
public final class CagedDtos {

    private CagedDtos() {
    }

    public record CagedResponse(String rootName,
                                int rootPitchClass,
                                String scaleId,
                                String scaleName,
                                String tuning,
                                List<Shape> shapes,
                                List<String> order) {
    }

    /** 一个 CAGED 形状（把位窗口）。 */
    public record Shape(String id,
                        int index,
                        String name,
                        String english,
                        int fretFrom,
                        int fretTo,
                        Anchor anchor,
                        List<ChordTone> chordTones,
                        List<Cell> cells,
                        String description) {
    }

    /** 形状里根音所在的弦与品（把位锚点）。 */
    public record Anchor(int string, int stringNumber, int fret, String noteName, int pitchClass) {
    }

    /** 大三和弦骨架音（根音 / 三音 / 五音），用于更醒目的标记。 */
    public record ChordTone(int string,
                            int stringNumber,
                            int fret,
                            String noteName,
                            int pitchClass,
                            String role) {
    }

    /** 把位窗口内属于当前音阶的格子。 */
    public record Cell(int string,
                       int stringNumber,
                       int fret,
                       String noteName,
                       int pitchClass,
                       String degreeLabel,
                       boolean inScale,
                       boolean isRoot) {
    }
}
