package com.yinjie.fretboard;

import com.yinjie.dto.FretboardDtos.Cell;
import com.yinjie.dto.FretboardDtos.FretboardResponse;
import com.yinjie.dto.FretboardDtos.ScaleNote;
import com.yinjie.dto.FretboardDtos.ScaleView;
import com.yinjie.dto.OptionsDtos;
import com.yinjie.dto.OptionsDtos.Defaults;
import com.yinjie.dto.OptionsDtos.FretRange;
import com.yinjie.dto.OptionsDtos.RootOption;
import com.yinjie.dto.OptionsDtos.ScaleOption;
import com.yinjie.dto.OptionsDtos.TuningOption;
import com.yinjie.dto.OptionsDtos.TuningString;
import com.yinjie.theory.Notes;
import com.yinjie.theory.ScaleCatalog;
import com.yinjie.theory.ScaleType;
import com.yinjie.theory.TheoryUtils;
import com.yinjie.theory.Tuning;
import com.yinjie.theory.TuningCatalog;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 指板数据与选项数据。内部弦序号 0 = 6 弦（低音弦）… 5 = 1 弦（高音弦）。
 * <p>标准调弦仍保留为静态常量（{@link #OPEN_MIDI} 等）；其它调弦通过 {@link Tuning} 传入。</p>
 */
@Service
public class FretboardService {

    public static final int MIN_FRET = 0;
    public static final int MAX_FRET = 24;

    /** 标准调弦空弦 MIDI：低 E、A、D、G、B、高 E。 */
    public static final int[] OPEN_MIDI = {40, 45, 50, 55, 59, 64};
    public static final int[] STRING_NUMBERS = {6, 5, 4, 3, 2, 1};
    public static final String[] OPEN_NAMES = {"E", "A", "D", "G", "B", "E"};

    public static final String APP_NAME = "yinjie";
    public static final String PRODUCT_NAME = "音阶指板工坊";
    public static final String TUNING_NAME = "标准调弦 E-A-D-G-B-E";

    /** 标准调弦下某弦某品的 MIDI 音高。 */
    public static int midiAt(int string, int fret) {
        validateString(string);
        if (fret < MIN_FRET || fret > MAX_FRET) {
            throw new IllegalArgumentException("品位数超出范围（0-24）: " + fret);
        }
        return OPEN_MIDI[string] + fret;
    }

    public static int stringNumber(int string) {
        validateString(string);
        return STRING_NUMBERS[string];
    }

    public static String openName(int string) {
        validateString(string);
        return OPEN_NAMES[string];
    }

    private static void validateString(int string) {
        if (string < 0 || string > 5) {
            throw new IllegalArgumentException("弦序号超出范围（0-5）: " + string);
        }
    }

    /** 解析 tuning 参数，非法时抛 IllegalArgumentException（由全局异常处理器转为 400）。 */
    public Tuning resolveTuning(String tuningParam) {
        return Tuning.parse(tuningParam);
    }

    public OptionsDtos.OptionsResponse options() {
        List<RootOption> roots = Notes.ROOT_NAMES.stream()
                .map(name -> new RootOption(
                        name,
                        Notes.pitchClass(name),
                        name.contains("b") ? "flat" : name.contains("#") ? "sharp" : "natural"))
                .toList();

        List<ScaleOption> scales = ScaleCatalog.all().stream()
                .map(s -> new ScaleOption(s.id(), s.name(), s.english(), s.category(), s.formula(), s.intervals()))
                .toList();

        List<TuningOption> tunings = TuningCatalog.all().stream()
                .map(preset -> new TuningOption(
                        preset.id(),
                        preset.name(),
                        preset.english(),
                        preset.tuningParam(),
                        Tuning.STRING_COUNT,
                        tuningStrings(preset.tuning())))
                .toList();

        return new OptionsDtos.OptionsResponse(
                APP_NAME,
                PRODUCT_NAME,
                roots,
                scales,
                tunings,
                TuningCatalog.DEFAULT_ID,
                new FretRange(MIN_FRET, MAX_FRET),
                new Defaults("C", "major", 0, 24, "auto")
        );
    }

    /** 标准调弦的弦信息（保留给旧代码使用）。 */
    public List<TuningString> tuningStrings() {
        return tuningStrings(Tuning.STANDARD);
    }

    public List<TuningString> tuningStrings(Tuning tuning) {
        List<TuningString> strings = new ArrayList<>();
        for (int i = 0; i < Tuning.STRING_COUNT; i++) {
            int midi = tuning.openMidi(i);
            strings.add(new TuningString(i, STRING_NUMBERS[i], tuning.openName(i), midi, Math.floorMod(midi, 12)));
        }
        return strings;
    }

    /** 标准调弦下的指板视图。 */
    public FretboardResponse build(String rootName, String scaleId, Integer fretFrom, Integer fretTo, String accidentalParam) {
        return build(rootName, scaleId, fretFrom, fretTo, accidentalParam, null);
    }

    /**
     * 生成指板视图：根音 + 音阶 + 品范围 + 调弦。所有格子都会返回，音阶外的音 inScale=false。
     */
    public FretboardResponse build(String rootName,
                                   String scaleId,
                                   Integer fretFrom,
                                   Integer fretTo,
                                   String accidentalParam,
                                   String tuningParam) {
        String root = rootName == null || rootName.isBlank() ? "C" : rootName.trim();
        String scaleKey = scaleId == null || scaleId.isBlank() ? "major" : scaleId.trim();
        ScaleType scale = ScaleCatalog.require(scaleKey);
        Tuning tuning = resolveTuning(tuningParam);

        Notes.Spelled rootSpelled;
        try {
            rootSpelled = Notes.parse(root);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("无效的根音：" + root);
        }

        int from = fretFrom == null ? MIN_FRET : fretFrom;
        int to = fretTo == null ? MAX_FRET : fretTo;
        if (from < MIN_FRET || to > MAX_FRET || from > to) {
            throw new IllegalArgumentException("品格范围必须在 0-24 之间，且起始品格不能大于结束品格");
        }

        String preference = TheoryUtils.accidentalPreference(root, accidentalParam);

        List<ScaleNote> scaleNotes = TheoryUtils.scaleNotes(scale, root);
        Map<Integer, ScaleNote> noteByPitchClass = new LinkedHashMap<>();
        for (ScaleNote note : scaleNotes) {
            noteByPitchClass.putIfAbsent(note.pitchClass(), note);
        }

        List<Cell> cells = new ArrayList<>();
        for (int string = 0; string < Tuning.STRING_COUNT; string++) {
            int openMidi = tuning.openMidi(string);
            for (int fret = from; fret <= to; fret++) {
                int midi = openMidi + fret;
                int pitchClass = Math.floorMod(midi, 12);
                ScaleNote scaleNote = noteByPitchClass.get(pitchClass);
                boolean inScale = scaleNote != null;
                int intervalFromRoot = Math.floorMod(pitchClass - rootSpelled.pitchClass(), 12);
                cells.add(new Cell(
                        string,
                        fret,
                        midi,
                        pitchClass,
                        inScale ? scaleNote.name() : Notes.spelling(pitchClass, preference),
                        inScale ? scaleNote.degreeLabel() : "",
                        Notes.chromaticDegree(intervalFromRoot, preference),
                        inScale,
                        inScale && pitchClass == rootSpelled.pitchClass(),
                        intervalFromRoot
                ));
            }
        }

        List<Integer> frets = new ArrayList<>();
        for (int fret = from; fret <= to; fret++) {
            frets.add(fret);
        }

        ScaleView scaleView = new ScaleView(
                scale.id(),
                scale.name(),
                scale.english(),
                scale.category(),
                scale.formula(),
                scale.intervals(),
                scaleNotes
        );

        return new FretboardResponse(
                root,
                rootSpelled.pitchClass(),
                preference,
                scaleView,
                tuningStrings(tuning),
                frets,
                cells
        );
    }
}
