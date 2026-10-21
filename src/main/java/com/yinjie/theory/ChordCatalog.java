package com.yinjie.theory;

import java.util.List;

/**
 * 内置和弦性质目录，供和弦识别使用。顺序也用作同分时的稳定排序依据。
 */
public final class ChordCatalog {

    private static final List<ChordQuality> QUALITIES = List.of(
            // ---- 三和弦 ----
            new ChordQuality("major", "大三和弦", "", "三和弦",
                    List.of(0, 4, 7), List.of("1", "3", "5"), List.of(0, 2, 4)),
            new ChordQuality("minor", "小三和弦", "m", "三和弦",
                    List.of(0, 3, 7), List.of("1", "b3", "5"), List.of(0, 2, 4)),
            new ChordQuality("diminished", "减三和弦", "dim", "三和弦",
                    List.of(0, 3, 6), List.of("1", "b3", "b5"), List.of(0, 2, 4)),
            new ChordQuality("augmented", "增三和弦", "aug", "三和弦",
                    List.of(0, 4, 8), List.of("1", "3", "#5"), List.of(0, 2, 4)),
            new ChordQuality("sus2", "挂二和弦", "sus2", "挂留和弦",
                    List.of(0, 2, 7), List.of("1", "2", "5"), List.of(0, 1, 4)),
            new ChordQuality("sus4", "挂四和弦", "sus4", "挂留和弦",
                    List.of(0, 5, 7), List.of("1", "4", "5"), List.of(0, 3, 4)),
            new ChordQuality("power", "强力和弦（五度双音）", "5", "强力和弦",
                    List.of(0, 7), List.of("1", "5"), List.of(0, 4)),

            // ---- 七和弦 ----
            new ChordQuality("major7", "大七和弦", "maj7", "七和弦",
                    List.of(0, 4, 7, 11), List.of("1", "3", "5", "7"), List.of(0, 2, 4, 6)),
            new ChordQuality("dominant7", "属七和弦", "7", "七和弦",
                    List.of(0, 4, 7, 10), List.of("1", "3", "5", "b7"), List.of(0, 2, 4, 6)),
            new ChordQuality("minor7", "小七和弦", "m7", "七和弦",
                    List.of(0, 3, 7, 10), List.of("1", "b3", "5", "b7"), List.of(0, 2, 4, 6)),
            new ChordQuality("minorMajor7", "小大七和弦", "mMaj7", "七和弦",
                    List.of(0, 3, 7, 11), List.of("1", "b3", "5", "7"), List.of(0, 2, 4, 6)),
            new ChordQuality("halfDiminished7", "半减七和弦", "m7b5", "七和弦",
                    List.of(0, 3, 6, 10), List.of("1", "b3", "b5", "b7"), List.of(0, 2, 4, 6)),
            new ChordQuality("diminished7", "减七和弦", "dim7", "七和弦",
                    List.of(0, 3, 6, 9), List.of("1", "b3", "b5", "bb7"), List.of(0, 2, 4, 6)),
            new ChordQuality("augmented7", "增七和弦（属七升五）", "7#5", "七和弦",
                    List.of(0, 4, 8, 10), List.of("1", "3", "#5", "b7"), List.of(0, 2, 4, 6)),
            new ChordQuality("augmentedMajor7", "增大七和弦", "maj7#5", "七和弦",
                    List.of(0, 4, 8, 11), List.of("1", "3", "#5", "7"), List.of(0, 2, 4, 6)),
            new ChordQuality("dominant7sus4", "属七挂四和弦", "7sus4", "七和弦",
                    List.of(0, 5, 7, 10), List.of("1", "4", "5", "b7"), List.of(0, 3, 4, 6)),

            // ---- 六和弦 ----
            new ChordQuality("major6", "大六和弦", "6", "六和弦",
                    List.of(0, 4, 7, 9), List.of("1", "3", "5", "6"), List.of(0, 2, 4, 5)),
            new ChordQuality("minor6", "小六和弦", "m6", "六和弦",
                    List.of(0, 3, 7, 9), List.of("1", "b3", "5", "6"), List.of(0, 2, 4, 5)),

            // ---- 扩展和弦 ----
            new ChordQuality("add9", "加九和弦", "add9", "扩展和弦",
                    List.of(0, 4, 7, 14), List.of("1", "3", "5", "9"), List.of(0, 2, 4, 8)),
            new ChordQuality("minorAdd9", "小加九和弦", "madd9", "扩展和弦",
                    List.of(0, 3, 7, 14), List.of("1", "b3", "5", "9"), List.of(0, 2, 4, 8)),
            new ChordQuality("dominant9", "属九和弦", "9", "扩展和弦",
                    List.of(0, 4, 7, 10, 14), List.of("1", "3", "5", "b7", "9"), List.of(0, 2, 4, 6, 8)),
            new ChordQuality("major9", "大九和弦", "maj9", "扩展和弦",
                    List.of(0, 4, 7, 11, 14), List.of("1", "3", "5", "7", "9"), List.of(0, 2, 4, 6, 8)),
            new ChordQuality("minor9", "小九和弦", "m9", "扩展和弦",
                    List.of(0, 3, 7, 10, 14), List.of("1", "b3", "5", "b7", "9"), List.of(0, 2, 4, 6, 8)),
            new ChordQuality("sixNine", "六九和弦", "6/9", "扩展和弦",
                    List.of(0, 4, 7, 9, 14), List.of("1", "3", "5", "6", "9"), List.of(0, 2, 4, 5, 8))
    );

    private ChordCatalog() {
    }

    public static List<ChordQuality> all() {
        return QUALITIES;
    }

    public static ChordQuality byId(String id) {
        return QUALITIES.stream().filter(q -> q.id().equals(id)).findFirst().orElse(null);
    }
}
