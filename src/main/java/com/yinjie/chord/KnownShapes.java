package com.yinjie.chord;

import com.yinjie.dto.ChordDtos.Position;

import java.util.List;

/**
 * 常用开放把位 / 封闭把位和弦指型库（CAGED 体系下的常见按法）。
 * 数组下标 0 = 低音 E 弦 … 5 = 高音 E 弦，-1 表示该弦不弹。
 */
public final class KnownShapes {

    private static final int MUTED = -1;

    private record Shape(String chordName, String description, int[] frets) {
    }

    private static final List<Shape> SHAPES = List.of(
            shape("C", "大三和弦开放把位", -1, 3, 2, 0, 1, 0),
            shape("A", "大三和弦开放把位", -1, 0, 2, 2, 2, 0),
            shape("G", "大三和弦开放把位", 3, 2, 0, 0, 0, 3),
            shape("E", "大三和弦开放把位", 0, 2, 2, 1, 0, 0),
            shape("D", "大三和弦开放把位", -1, -1, 0, 2, 3, 2),
            shape("F", "大三和弦封闭把位", 1, 3, 3, 2, 1, 1),
            shape("C#/Db", "大三和弦封闭把位", -1, 4, 6, 6, 6, 4),
            shape("D#/Eb", "大三和弦封闭把位", -1, 6, 8, 8, 8, 6),
            shape("F#/Gb", "大三和弦封闭把位", 2, 4, 4, 3, 2, 2),
            shape("G#/Ab", "大三和弦封闭把位", 4, 6, 6, 5, 4, 4),
            shape("A#/Bb", "大三和弦封闭把位", -1, 1, 3, 3, 3, 1),
            shape("B", "大三和弦封闭把位", -1, 2, 4, 4, 4, 2),
            shape("Am", "小三和弦开放把位", -1, 0, 2, 2, 1, 0),
            shape("Em", "小三和弦开放把位", 0, 2, 2, 0, 0, 0),
            shape("Dm", "小三和弦开放把位", -1, -1, 0, 2, 3, 1),
            shape("A7", "属七和弦开放把位", -1, 0, 2, 0, 2, 0),
            shape("E7", "属七和弦开放把位", 0, 2, 0, 1, 0, 0),
            shape("D7", "属七和弦开放把位", -1, -1, 0, 2, 1, 2),
            shape("Cmaj7", "大七和弦开放把位", -1, 3, 2, 0, 0, 0),
            shape("Fmaj7", "大七和弦封闭把位", -1, 3, 3, 2, 1, 0),
            shape("Am7", "小七和弦开放把位", -1, 0, 2, 0, 1, 0),
            shape("Em7", "小七和弦开放把位", 0, 2, 0, 0, 0, 0),
            shape("Dm7", "小七和弦开放把位", -1, -1, 0, 2, 1, 1),
            shape("E5", "强力和弦（五度双音）", 0, 2, 2, -1, -1, -1),
            shape("A5", "强力和弦（五度双音）", -1, 0, 2, 2, -1, -1)
    );

    private KnownShapes() {
    }

    private static Shape shape(String chordName, String description, int... frets) {
        return new Shape(chordName, description, frets);
    }

    /**
     * 若点选的品格集合与某个已知指型完全一致，返回形如 "C 大三和弦（x32010）" 的提示。
     */
    public static String match(List<Position> positions) {
        int[] selected = new int[6];
        java.util.Arrays.fill(selected, -2);
        for (Position position : positions) {
            if (position.string() >= 0 && position.string() < 6) {
                selected[position.string()] = position.fret();
            }
        }
        for (Shape shape : SHAPES) {
            boolean same = true;
            for (int i = 0; i < 6; i++) {
                int expected = shape.frets()[i];
                if (expected == MUTED) {
                    if (selected[i] != -2) {
                        same = false;
                        break;
                    }
                } else if (selected[i] != expected) {
                    same = false;
                    break;
                }
            }
            if (same) {
                return shape.chordName() + " " + shape.description() + "（" + diagram(shape.frets()) + "）";
            }
        }
        return null;
    }

    private static String diagram(int[] frets) {
        StringBuilder builder = new StringBuilder();
        for (int fret : frets) {
            builder.append(fret == MUTED ? "x" : Integer.toString(fret));
        }
        return builder.toString();
    }
}
