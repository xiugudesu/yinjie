package com.yinjie.theory;

import java.util.Locale;

/**
 * 六弦电吉他的调弦数据。
 * <p>内部弦序号 0 = 6 弦（低音弦）… 5 = 1 弦（高音弦）；
 * 每根弦记录空弦 MIDI 音高与音名（不带八度），并提供按品推算音高的方法。</p>
 *
 * <p>字符串格式（用于 REST 参数 tuning）为「音名+八度」6 个、英文逗号分隔、6 弦→1 弦，
 * 例如标准调弦 {@code E2,A2,D3,G3,B3,E4}。</p>
 */
public final class Tuning {

    public static final int STRING_COUNT = 6;
    /** 标准调弦的换算参数。 */
    public static final String STANDARD_PARAM = "E2,A2,D3,G3,B3,E4";

    /** 标准调弦：低 E、A、D、G、B、高 E。 */
    public static final Tuning STANDARD = new Tuning(
            new int[]{40, 45, 50, 55, 59, 64},
            new String[]{"E", "A", "D", "G", "B", "E"});

    private static final int MIN_MIDI = 0;
    private static final int MAX_MIDI = 127;

    private final int[] openMidi;
    private final String[] openNames;

    private Tuning(int[] openMidi, String[] openNames) {
        if (openMidi.length != STRING_COUNT || openNames.length != STRING_COUNT) {
            throw new IllegalArgumentException("调弦必须包含 6 根弦");
        }
        this.openMidi = openMidi.clone();
        this.openNames = openNames.clone();
    }

    /** 解析 tuning 参数；null 或空白等价于标准调弦。 */
    public static Tuning parse(String tuningParam) {
        if (tuningParam == null || tuningParam.isBlank()) {
            return STANDARD;
        }
        String[] tokens = tuningParam.trim().split(",", -1);
        if (tokens.length != STRING_COUNT) {
            throw new IllegalArgumentException(
                    "调弦格式错误：需要 6 个「音名+八度」并用英文逗号分隔（6 弦→1 弦），例如 "
                            + STANDARD_PARAM + "，当前为 " + tokens.length + " 项");
        }
        int[] midi = new int[STRING_COUNT];
        String[] names = new String[STRING_COUNT];
        for (int i = 0; i < STRING_COUNT; i++) {
            ParsedNote parsed = parseToken(tokens[i], i);
            midi[i] = parsed.midi();
            names[i] = parsed.name();
        }
        return new Tuning(midi, names);
    }

    /** 用 6 个空弦 MIDI 音高构造调弦（音名按升号拼写）。 */
    public static Tuning ofMidi(int[] openMidi) {
        if (openMidi.length != STRING_COUNT) {
            throw new IllegalArgumentException("调弦必须包含 6 根弦");
        }
        int[] copy = openMidi.clone();
        String[] names = new String[STRING_COUNT];
        for (int i = 0; i < STRING_COUNT; i++) {
            validateMidi(copy[i], i);
            names[i] = Notes.SHARP_NAMES.get(Math.floorMod(copy[i], 12));
        }
        return new Tuning(copy, names);
    }

    /**
     * 解析单个「音名+八度」记号，例如 E2、F#3、Bb2、E♭4。
     */
    private static ParsedNote parseToken(String rawToken, int stringIndex) {
        String token = rawToken == null ? "" : rawToken.trim();
        if (token.isEmpty()) {
            throw new IllegalArgumentException("调弦格式错误：第 " + (stringIndex + 1) + " 项为空");
        }
        token = token.replace('♯', '#').replace('♭', 'b');
        int letterIndex = Notes.LETTERS.indexOf(String.valueOf(Character.toUpperCase(token.charAt(0))));
        if (letterIndex < 0) {
            throw new IllegalArgumentException("调弦格式错误：无效音名 " + rawToken
                    + "（应为 A-G + 可选 #/b + 八度，例如 E2）");
        }
        int pos = 1;
        int accidental = 0;
        while (pos < token.length()) {
            char c = token.charAt(pos);
            if (c == '#') {
                accidental++;
            } else if (c == 'b') {
                accidental--;
            } else {
                break;
            }
            pos++;
        }
        if (pos >= token.length()) {
            throw new IllegalArgumentException("调弦格式错误：缺少八度数字 " + rawToken + "（例如 E2）");
        }
        String octaveText = token.substring(pos);
        if (!octaveText.chars().allMatch(Character::isDigit)) {
            throw new IllegalArgumentException("调弦格式错误：无效八度 " + rawToken + "（应为 0-8 的数字）");
        }
        int octave = Integer.parseInt(octaveText);
        if (octave < 0 || octave > 8) {
            throw new IllegalArgumentException("调弦格式错误：八度超出范围 " + rawToken + "（应在 0-8 之间）");
        }
        int pitchClass = Math.floorMod(Notes.NATURAL_PITCH[letterIndex] + accidental, 12);
        int midi = (octave + 1) * 12 + pitchClass;
        validateMidi(midi, stringIndex);
        String base = Notes.LETTERS.get(letterIndex);
        String accidentalText = accidental > 0 ? "#".repeat(accidental) : "b".repeat(-accidental);
        return new ParsedNote(midi, base + accidentalText);
    }

    private static void validateMidi(int midi, int stringIndex) {
        if (midi < MIN_MIDI || midi > MAX_MIDI) {
            throw new IllegalArgumentException("调弦格式错误：第 " + (stringIndex + 1)
                    + " 项音高超出 MIDI 范围（0-127）");
        }
    }

    private record ParsedNote(int midi, String name) {
    }

    public int openMidi(int string) {
        validateString(string);
        return openMidi[string];
    }

    /** 空弦音名（不带八度），保留用户书写时的升降号，例如 Eb、F#。 */
    public String openName(int string) {
        validateString(string);
        return openNames[string];
    }

    public int[] openMidiArray() {
        return openMidi.clone();
    }

    public String openParam(int string) {
        validateString(string);
        return openNames[string] + octaveOf(openMidi[string]);
    }

    /** 该调弦的规范化参数串。 */
    public String param() {
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < STRING_COUNT; i++) {
            if (i > 0) {
                builder.append(',');
            }
            builder.append(openParam(i));
        }
        return builder.toString();
    }

    public boolean isStandard() {
        return java.util.Arrays.equals(openMidi, STANDARD.openMidi);
    }

    /** 按品推算 MIDI 音高。 */
    public int midiAt(int string, int fret) {
        validateString(string);
        if (fret < 0 || fret > 24) {
            throw new IllegalArgumentException("品位数超出范围（0-24）: " + fret);
        }
        return openMidi[string] + fret;
    }

    private static int octaveOf(int midi) {
        return Math.floorDiv(midi, 12) - 1;
    }

    private static void validateString(int string) {
        if (string < 0 || string >= STRING_COUNT) {
            throw new IllegalArgumentException("弦序号超出范围（0-5）: " + string);
        }
    }

    /** 便于调试与日志的紧凑描述。 */
    @Override
    public String toString() {
        return "Tuning[" + param() + "]";
    }

    /** 供 UI 显示的全大写英文名（例如 STANDARD → "STANDARD E-A-D-G-B-E"）。 */
    public String displayName() {
        return param().toUpperCase(Locale.ROOT);
    }
}
