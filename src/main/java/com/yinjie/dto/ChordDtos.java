package com.yinjie.dto;

import java.util.List;

/** 和弦识别请求 / 响应结构。 */
public final class ChordDtos {

    private ChordDtos() {
    }

    public record Position(int string, int fret) {
    }

    /** 和弦识别请求；tuning 可选（省略 = 标准调弦）。 */
    public record IdentifyRequest(List<Position> positions, String scaleId, String rootName, String tuning) {
    }

    public record IdentifyResponse(int count,
                                   String scaleId,
                                   String scaleName,
                                   String scaleRootName,
                                   List<String> scaleNotes,
                                   List<SelectionNote> selection,
                                   ChordInfo chord,
                                   List<ChordAlternative> alternatives,
                                   List<String> hints) {
    }

    public record SelectionNote(int string,
                                int stringNumber,
                                int fret,
                                int midi,
                                String noteName,
                                int pitchClass,
                                boolean inScale,
                                String scaleDegreeLabel,
                                String chordRole,
                                String chordRoleName) {
    }

    public record ChordInfo(String symbol,
                            String name,
                            String rootName,
                            int rootPitchClass,
                            String qualityId,
                            String qualityName,
                            String suffix,
                            List<ChordTone> tones,
                            Bass bass,
                            String inversion,
                            String matchType,
                            int score,
                            List<String> missing,
                            List<String> extra,
                            String description,
                            String shapeHint) {
    }

    public record ChordTone(String degreeLabel,
                            String noteName,
                            int pitchClass,
                            String role,
                            boolean present) {
    }

    public record Bass(int string,
                       int stringNumber,
                       int fret,
                       String noteName,
                       int pitchClass,
                       String role) {
    }

    public record ChordAlternative(String symbol,
                                   String name,
                                   String rootName,
                                   String qualityName,
                                   String matchType,
                                   int score,
                                   List<String> missing,
                                   List<String> extra,
                                   String inversion) {
    }
}
