package com.yinjie.caged;

import com.yinjie.dto.CagedDtos.Anchor;
import com.yinjie.dto.CagedDtos.CagedResponse;
import com.yinjie.dto.CagedDtos.Cell;
import com.yinjie.dto.CagedDtos.ChordTone;
import com.yinjie.dto.CagedDtos.Shape;
import com.yinjie.dto.FretboardDtos.ScaleNote;
import com.yinjie.fretboard.FretboardService;
import com.yinjie.theory.Notes;
import com.yinjie.theory.ScaleCatalog;
import com.yinjie.theory.ScaleType;
import com.yinjie.theory.TheoryUtils;
import com.yinjie.theory.Tuning;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * CAGED 系统指板图：把大三和弦的 5 个手型（C/A/G/E/D）按根音位置移到指板上，
 * 求出每个形状的把位窗口，再在窗口内标出当前音阶的音。
 *
 * <p>手型数据（相对根音所在弦的「品偏移」，数组下标 0 = 6 弦 … 5 = 1 弦）：</p>
 * <ul>
 *   <li>C 形状：根音在 5 弦，x32010 → 0 / -1 / -3 / -2 / -3</li>
 *   <li>A 形状：根音在 5 弦，x02220 → 0 / +2 / +2 / +2 / 0</li>
 *   <li>G 形状：根音在 6 弦，320003 → 0 / -1 / -3 / -3 / -3 / 0</li>
 *   <li>E 形状：根音在 6 弦，022100 → 0 / +2 / +2 / +1 / 0 / 0</li>
 *   <li>D 形状：根音在 4 弦，xx0232 → 0 / +2 / +3 / +2</li>
 * </ul>
 */
@Service
public class CagedService {

    private static final int MUTED = Integer.MIN_VALUE;

    private static final String ROLE_ROOT = "根音";
    private static final String ROLE_THIRD = "大三音";
    private static final String ROLE_FIFTH = "纯五音";

    private record ShapeTemplate(String id,
                                 int index,
                                 String name,
                                 String english,
                                 int anchorString,
                                 int[] offsets) {
    }

    private static final List<ShapeTemplate> TEMPLATES = List.of(
            new ShapeTemplate("C", 1, "C 形状", "C Shape", 1,
                    new int[]{MUTED, 0, -1, -3, -2, -3}),
            new ShapeTemplate("A", 2, "A 形状", "A Shape", 1,
                    new int[]{MUTED, 0, 2, 2, 2, 0}),
            new ShapeTemplate("G", 3, "G 形状", "G Shape", 0,
                    new int[]{0, -1, -3, -3, -3, 0}),
            new ShapeTemplate("E", 4, "E 形状", "E Shape", 0,
                    new int[]{0, 2, 2, 1, 0, 0}),
            new ShapeTemplate("D", 5, "D 形状", "D Shape", 2,
                    new int[]{MUTED, MUTED, 0, 2, 3, 2})
    );

    private static final List<String> ORDER = List.of("C", "A", "G", "E", "D");

    public CagedResponse build(String rootName,
                               String scaleId,
                               String tuningParam,
                               Integer fretFrom,
                               Integer fretTo) {
        String root = rootName == null || rootName.isBlank() ? "C" : rootName.trim();
        String scaleKey = scaleId == null || scaleId.isBlank() ? "major" : scaleId.trim();
        ScaleType scale = ScaleCatalog.require(scaleKey);
        Tuning tuning = Tuning.parse(tuningParam);

        Notes.Spelled rootSpelled;
        try {
            rootSpelled = Notes.parse(root);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("无效的根音：" + root);
        }
        int rootPitchClass = rootSpelled.pitchClass();

        int from = fretFrom == null ? FretboardService.MIN_FRET : fretFrom;
        int to = fretTo == null ? FretboardService.MAX_FRET : fretTo;
        if (from < FretboardService.MIN_FRET || to > FretboardService.MAX_FRET || from > to) {
            throw new IllegalArgumentException("品格范围必须在 0-24 之间，且起始品格不能大于结束品格");
        }

        String preference = TheoryUtils.accidentalPreference(root, null);

        Map<Integer, ScaleNote> scaleNoteByPc = new LinkedHashMap<>();
        for (ScaleNote note : TheoryUtils.scaleNotes(scale, root)) {
            scaleNoteByPc.putIfAbsent(note.pitchClass(), note);
        }

        List<Shape> shapes = new ArrayList<>();
        for (ShapeTemplate template : TEMPLATES) {
            Shape shape = buildShape(template, rootPitchClass, tuning, scaleNoteByPc, from, to, preference);
            if (shape != null) {
                shapes.add(shape);
            }
        }

        return new CagedResponse(
                root,
                rootPitchClass,
                scale.id(),
                scale.name(),
                tuning.param(),
                shapes,
                ORDER
        );
    }

    private Shape buildShape(ShapeTemplate template,
                             int rootPitchClass,
                             Tuning tuning,
                             Map<Integer, ScaleNote> scaleNoteByPc,
                             int from,
                             int to,
                             String preference) {
        int anchorString = template.anchorString();
        int anchorFret = Math.floorMod(rootPitchClass - tuning.openMidi(anchorString), 12);

        int[] frets = new int[Tuning.STRING_COUNT];
        boolean[] active = new boolean[Tuning.STRING_COUNT];
        for (int string = 0; string < Tuning.STRING_COUNT; string++) {
            int offset = template.offsets()[string];
            if (offset != MUTED) {
                frets[string] = anchorFret + offset;
                active[string] = true;
            }
        }

        int minFret = Integer.MAX_VALUE;
        int maxFret = Integer.MIN_VALUE;
        for (int string = 0; string < Tuning.STRING_COUNT; string++) {
            if (active[string]) {
                minFret = Math.min(minFret, frets[string]);
                maxFret = Math.max(maxFret, frets[string]);
            }
        }
        if (minFret == Integer.MAX_VALUE) {
            return null;
        }

        // 手型落到底把位以下时整体抬高一个八度（+12 品）
        if (minFret < FretboardService.MIN_FRET) {
            for (int string = 0; string < Tuning.STRING_COUNT; string++) {
                if (active[string]) {
                    frets[string] += 12;
                }
            }
            anchorFret += 12;
            minFret += 12;
            maxFret += 12;
        }
        if (minFret < FretboardService.MIN_FRET || maxFret > FretboardService.MAX_FRET) {
            return null;
        }

        int windowFrom = Math.max(from, Math.max(FretboardService.MIN_FRET, minFret - 1));
        int windowTo = Math.min(to, Math.min(FretboardService.MAX_FRET, maxFret + 1));
        if (windowFrom > windowTo) {
            return null;
        }

        List<Cell> cells = new ArrayList<>();
        for (int string = 0; string < Tuning.STRING_COUNT; string++) {
            int openMidi = tuning.openMidi(string);
            for (int fret = windowFrom; fret <= windowTo; fret++) {
                int pitchClass = Math.floorMod(openMidi + fret, 12);
                ScaleNote scaleNote = scaleNoteByPc.get(pitchClass);
                if (scaleNote == null) {
                    continue;
                }
                cells.add(new Cell(
                        string,
                        FretboardService.STRING_NUMBERS[string],
                        fret,
                        scaleNote.name(),
                        pitchClass,
                        scaleNote.degreeLabel(),
                        true,
                        pitchClass == rootPitchClass
                ));
            }
        }

        List<ChordTone> chordTones = new ArrayList<>();
        for (int string = 0; string < Tuning.STRING_COUNT; string++) {
            if (!active[string]) {
                continue;
            }
            int midi = tuning.openMidi(string) + frets[string];
            int pitchClass = Math.floorMod(midi, 12);
            int interval = Math.floorMod(pitchClass - rootPitchClass, 12);
            String role = switch (interval) {
                case 0 -> ROLE_ROOT;
                case 4 -> ROLE_THIRD;
                case 7 -> ROLE_FIFTH;
                default -> null;
            };
            if (role == null) {
                continue;
            }
            ScaleNote scaleNote = scaleNoteByPc.get(pitchClass);
            String noteName = scaleNote != null
                    ? scaleNote.name()
                    : Notes.spelling(pitchClass, preference);
            chordTones.add(new ChordTone(
                    string,
                    FretboardService.STRING_NUMBERS[string],
                    frets[string],
                    noteName,
                    pitchClass,
                    role
            ));
        }

        String anchorNoteName = scaleNoteByPc.containsKey(rootPitchClass)
                ? scaleNoteByPc.get(rootPitchClass).name()
                : Notes.spelling(rootPitchClass, preference);
        Anchor anchor = new Anchor(
                anchorString,
                FretboardService.STRING_NUMBERS[anchorString],
                anchorFret,
                anchorNoteName,
                rootPitchClass
        );

        String description = template.name() + "：根音落在 " + FretboardService.STRING_NUMBERS[anchorString]
                + " 弦 " + anchorFret + " 品，把位窗口 " + windowFrom + "–" + windowTo + " 品。";

        return new Shape(
                template.id(),
                template.index(),
                template.name(),
                template.english(),
                windowFrom,
                windowTo,
                anchor,
                chordTones,
                cells,
                description
        );
    }
}
