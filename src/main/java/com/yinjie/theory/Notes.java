package com.yinjie.theory;

import java.util.List;

/**
 * 音名、音高类与拼写工具。
 * <p>音高类 0-11 对应 C, C#/Db, D, ... B。所有"拼写"（spell）都按字母距离 + 变音记号计算，
 * 这样可以区分 C# 与 Db、E# 与 F —— 和弦与音阶的音名必须拼写正确。</p>
 */
public final class Notes {

    public static final List<String> LETTERS = List.of("C", "D", "E", "F", "G", "A", "B");
    /** 自然音级 C D E F G A B 对应音高类。 */
    public static final int[] NATURAL_PITCH = {0, 2, 4, 5, 7, 9, 11};

    public static final List<String> SHARP_NAMES =
            List.of("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B");
    public static final List<String> FLAT_NAMES =
            List.of("C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B");
    /** 无升降号倾向时混用：C Db D Eb E F F# G Ab A Bb B。 */
    public static final List<String> MIXED_NAMES =
            List.of("C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B");

    /** 可供选择的 14 种根音拼写。 */
    public static final List<String> ROOT_NAMES =
            List.of("C", "C#", "Db", "D", "Eb", "E", "F", "F#", "Gb", "G", "Ab", "A", "Bb", "B");

    public static final String[] CHROMATIC_SHARP =
            {"1", "#1", "2", "#2", "3", "4", "#4", "5", "#5", "6", "#6", "7"};
    public static final String[] CHROMATIC_FLAT =
            {"1", "b2", "2", "b3", "3", "4", "b5", "5", "b6", "6", "b7", "7"};
    public static final String[] CHROMATIC_MIXED =
            {"1", "b2", "2", "b3", "3", "4", "#4", "5", "b6", "6", "b7", "7"};

    public static final String[] INTERVAL_NAMES = {
            "纯一度", "小二度", "大二度", "小三度", "大三度", "纯四度", "增四度/减五度",
            "纯五度", "小六度", "大六度", "小七度", "大七度", "纯八度"
    };

    private Notes() {
    }

    /** 解析后的音名：字母序号（C=0..B=6）、变音记号数、音高类。 */
    public record Spelled(int letterIndex, int accidental, int pitchClass) {
        public String letter() {
            return LETTERS.get(letterIndex);
        }
    }

    /** 解析诸如 C、F#、Bb、Ebb 的音名。 */
    public static Spelled parse(String name) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("音名不能为空");
        }
        String trimmed = name.trim();
        int letterIndex = LETTERS.indexOf(String.valueOf(Character.toUpperCase(trimmed.charAt(0))));
        if (letterIndex < 0) {
            throw new IllegalArgumentException("无效音名: " + name);
        }
        int accidental = 0;
        for (int i = 1; i < trimmed.length(); i++) {
            char c = trimmed.charAt(i);
            if (c == '#') {
                accidental++;
            } else if (c == 'b') {
                accidental--;
            } else {
                throw new IllegalArgumentException("无效音名: " + name);
            }
        }
        int pitchClass = Math.floorMod(NATURAL_PITCH[letterIndex] + accidental, 12);
        return new Spelled(letterIndex, accidental, pitchClass);
    }

    public static int pitchClass(String name) {
        return parse(name).pitchClass();
    }

    /**
     * 用指定的字母拼出目标音高类，例如 spell(6, 3) = "F#"（字母 F + 一个升号），spell(6, 4) = "Gb"。
     */
    public static String spell(int pitchClass, int letterIndex) {
        int letter = Math.floorMod(letterIndex, 7);
        int target = Math.floorMod(pitchClass, 12);
        int diff = Math.floorMod(target - NATURAL_PITCH[letter] + 6, 12) - 6;
        String base = LETTERS.get(letter);
        if (diff > 2) {
            return base + "#".repeat(diff);
        }
        if (diff < -2) {
            return base + "b".repeat(-diff);
        }
        return base + switch (diff) {
            case -2 -> "bb";
            case -1 -> "b";
            case 1 -> "#";
            case 2 -> "##";
            default -> "";
        };
    }

    /** 按升号 / 降号 / 混用偏好直接拼写音高类。 */
    public static String spelling(int pitchClass, String preference) {
        List<String> names = "flat".equals(preference) ? FLAT_NAMES
                : "sharp".equals(preference) ? SHARP_NAMES
                : MIXED_NAMES;
        return names.get(Math.floorMod(pitchClass, 12));
    }

    /** 相对根音的半音数对应的级数标签，例如 6 -> "#4"（混用偏好）。 */
    public static String chromaticDegree(int intervalFromRoot, String preference) {
        String[] table = "flat".equals(preference) ? CHROMATIC_FLAT
                : "sharp".equals(preference) ? CHROMATIC_SHARP
                : CHROMATIC_MIXED;
        return table[Math.floorMod(intervalFromRoot, 12)];
    }

    public static String intervalName(int semitones) {
        if (semitones >= 0 && semitones < INTERVAL_NAMES.length) {
            return INTERVAL_NAMES[semitones];
        }
        return "复合音程";
    }
}
