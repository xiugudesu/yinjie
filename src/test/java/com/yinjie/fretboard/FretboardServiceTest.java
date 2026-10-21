package com.yinjie.fretboard;

import com.yinjie.dto.FretboardDtos.Cell;
import com.yinjie.dto.FretboardDtos.FretboardResponse;
import com.yinjie.dto.OptionsDtos.OptionsResponse;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 指板构造：标准调弦 E-A-D-G-B-E、0-24 品、音阶内音与品格的对应关系。
 */
class FretboardServiceTest {

    private final FretboardService service = new FretboardService();

    @Test
    void exposesOptions() {
        OptionsResponse options = service.options();
        assertEquals("yinjie", options.appName());
        assertEquals("音阶指板工坊", options.productName());
        assertEquals(14, options.roots().size());
        assertEquals(17, options.scales().size());
        assertEquals(6, options.tunings().size());
        assertEquals("standard", options.defaultTuning());
        assertEquals("standard", options.tunings().get(0).id());
        assertEquals("E2,A2,D3,G3,B3,E4", options.tunings().get(0).tuningParam());
        assertEquals("Drop D", options.tunings().get(1).english());
        assertEquals(6, options.tunings().get(0).strings().size());
        assertEquals(0, options.fretRange().min());
        assertEquals(24, options.fretRange().max());
        assertEquals("C", options.defaults().rootName());
        assertEquals("major", options.defaults().scaleId());
        // 弦序号 6(低 E) → 1(高 E)，index 0 = 低 E
        assertEquals(6, options.tunings().get(0).strings().get(0).number());
        assertEquals(1, options.tunings().get(0).strings().get(5).number());
        assertEquals(40, options.tunings().get(0).strings().get(0).openMidi());
        assertEquals(64, options.tunings().get(0).strings().get(5).openMidi());
    }

    @Test
    void buildsFretboardGeometry() {
        FretboardResponse view = service.build("C", "major", 0, 12, null);
        assertEquals("C", view.rootName());
        assertEquals(0, view.rootPitchClass());
        assertEquals("mixed", view.accidental());
        assertEquals(6, view.strings().size());
        assertEquals(13, view.frets().size());
        assertEquals(78, view.cells().size());
        assertEquals(7, view.scale().notes().size());
    }

    @Test
    void mapsOpenStringsAndFretsToNotes() {
        FretboardResponse view = service.build("C", "major", 0, 24, null);
        // 空弦：低 E = 3 级（E），A 弦 3 品 = C 根音
        assertEquals("E", cell(view, 0, 0).noteName());
        assertEquals("3", cell(view, 0, 0).degreeLabel());
        assertEquals(40, cell(view, 0, 0).midi());
        assertEquals(4, cell(view, 0, 0).intervalFromRoot());

        Cell c = cell(view, 1, 3);
        assertEquals("C", c.noteName());
        assertEquals("1", c.degreeLabel());
        assertTrue(c.isRoot());
        assertEquals(48, c.midi());

        // 高 E 弦 12 品仍是 E，但高八度
        assertEquals("E", cell(view, 5, 12).noteName());
        assertEquals(76, cell(view, 5, 12).midi());
        // 标准调弦相邻弦（除 G→B）为纯四度
        assertEquals(5, Math.floorMod(cell(view, 1, 0).pitchClass() - cell(view, 0, 0).pitchClass(), 12));
        assertEquals(4, Math.floorMod(cell(view, 4, 0).pitchClass() - cell(view, 3, 0).pitchClass(), 12));
    }

    @Test
    void marksNonScaleNotes() {
        FretboardResponse view = service.build("C", "major", 0, 5, null);
        Cell fSharp = cell(view, 0, 2); // F#
        assertFalse(fSharp.inScale());
        assertEquals("", fSharp.degreeLabel());
        assertEquals("F#", fSharp.noteName());
        assertEquals(6, fSharp.pitchClass());

        FretboardResponse withFlat = service.build("C", "major", 0, 5, "flat");
        assertEquals("Gb", cell(withFlat, 0, 2).noteName());
        assertEquals("flat", withFlat.accidental());
    }

    @Test
    void spellsScaleNotesWithCorrectEnharmonics() {
        FretboardResponse fMajor = service.build("F", "major", 0, 24, null);
        assertTrue(fMajor.scale().notes().stream().anyMatch(n -> n.name().equals("Bb") && n.pitchClass() == 10));
        // A 弦 1 品 = Bb（F 大调的 4 级）
        assertEquals("Bb", cell(fMajor, 1, 1).noteName());
    }

    @Test
    void validatesInput() {
        assertThrows(IllegalArgumentException.class, () -> service.build("C", "nope", 0, 24, null));
        assertThrows(IllegalArgumentException.class, () -> service.build("H", "major", 0, 24, null));
        assertThrows(IllegalArgumentException.class, () -> service.build("C", "major", -1, 24, null));
        assertThrows(IllegalArgumentException.class, () -> service.build("C", "major", 0, 25, null));
        assertThrows(IllegalArgumentException.class, () -> service.build("C", "major", 5, 3, null));
    }

    @Test
    void supportsCustomTunings() {
        FretboardResponse dropD = service.build("C", "major", 0, 3, null, "D2,A2,D3,G3,B3,E4");
        assertEquals("D", dropD.strings().get(0).openName());
        assertEquals(38, dropD.strings().get(0).openMidi());
        assertEquals("D", cell(dropD, 0, 0).noteName());
        assertEquals("2", cell(dropD, 0, 0).degreeLabel());
        // 只改 6 弦：A 弦 3 品依然是 C
        assertEquals("C", cell(dropD, 1, 3).noteName());

        FretboardResponse dadgad = service.build("C", "major", 0, 12, null, "D2,A2,D3,G3,A3,D4");
        assertEquals("A", cell(dadgad, 4, 0).noteName());
        assertEquals(57, cell(dadgad, 4, 0).midi());
        assertEquals("D", dadgad.strings().get(5).openName());
        assertEquals(62, dadgad.strings().get(5).openMidi());
    }

    @Test
    void validatesTuningParameter() {
        assertThrows(IllegalArgumentException.class,
                () -> service.build("C", "major", 0, 24, null, "E2,A2,D3"));
        assertThrows(IllegalArgumentException.class,
                () -> service.build("C", "major", 0, 24, null, "H2,A2,D3,G3,B3,E4"));
    }

    private static Cell cell(FretboardResponse view, int string, int fret) {
        Optional<Cell> found = view.cells().stream()
                .filter(c -> c.string() == string && c.fret() == fret)
                .findFirst();
        assertTrue(found.isPresent(), "缺少 string=" + string + " fret=" + fret + " 的品格数据");
        return found.get();
    }
}
