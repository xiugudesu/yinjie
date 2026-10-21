package com.yinjie.theory;

import com.yinjie.dto.FretboardDtos.ScaleNote;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 乐理基础：音名拼写、音阶公式拼写、音程命名、和弦性质。
 */
class TheoryTest {

    @Test
    void parsesNoteNames() {
        Notes.Spelled db = Notes.parse("Db");
        assertEquals(1, db.pitchClass());
        assertEquals(1, db.letterIndex());
        assertEquals(-1, db.accidental());
        assertEquals("D", db.letter());

        assertEquals(9, Notes.pitchClass("A"));
        assertEquals(0, Notes.pitchClass("C"));
        assertEquals(6, Notes.pitchClass("F#"));
        assertEquals(10, Notes.pitchClass("Bb"));
        assertThrows(IllegalArgumentException.class, () -> Notes.parse("H"));
        assertThrows(IllegalArgumentException.class, () -> Notes.parse(""));
    }

    @Test
    void spellsPitchClasses() {
        assertEquals("C#", Notes.spelling(1, "sharp"));
        assertEquals("Db", Notes.spelling(1, "flat"));
        assertEquals("Db", Notes.spelling(1, "mixed"));
        assertEquals("Bb", Notes.spelling(10, "flat"));
        assertEquals("A#", Notes.spelling(10, "sharp"));
        // 三度叠置拼写：letterIndex 6 = B
        assertEquals("Bb", Notes.spell(10, 6));
        assertEquals("C", Notes.spell(0, 0));
        assertEquals("F#", Notes.spell(6, 3));
        assertEquals("E#", Notes.spell(5, 2));
        assertEquals("Cb", Notes.spell(11, 0));
    }

    @Test
    void namesIntervals() {
        assertEquals("纯一度", Notes.intervalName(0));
        assertEquals("小二度", Notes.intervalName(1));
        assertEquals("大三度", Notes.intervalName(4));
        assertEquals("纯四度", Notes.intervalName(5));
        assertEquals("纯五度", Notes.intervalName(7));
        assertEquals("大七度", Notes.intervalName(11));
        assertTrue(Notes.intervalName(6).contains("增四度"));
    }

    @Test
    void spellsMajorScaleFromAnyRoot() {
        assertScale(TheoryUtils.scaleNotes(ScaleCatalog.require("major"), "C"),
                List.of("C", "D", "E", "F", "G", "A", "B"),
                List.of("1", "2", "3", "4", "5", "6", "7"));
        // F 大调必须出现 Bb（不能写成 A#）
        assertScale(TheoryUtils.scaleNotes(ScaleCatalog.require("major"), "F"),
                List.of("F", "G", "A", "Bb", "C", "D", "E"),
                List.of("1", "2", "3", "4", "5", "6", "7"));
        // F# 大调必须出现 E#
        assertScale(TheoryUtils.scaleNotes(ScaleCatalog.require("major"), "F#"),
                List.of("F#", "G#", "A#", "B", "C#", "D#", "E#"),
                List.of("1", "2", "3", "4", "5", "6", "7"));
    }

    @Test
    void spellsMinorAndBluesScales() {
        assertScale(TheoryUtils.scaleNotes(ScaleCatalog.require("natural-minor"), "C"),
                List.of("C", "D", "Eb", "F", "G", "Ab", "Bb"),
                List.of("1", "2", "b3", "4", "5", "b6", "b7"));
        assertScale(TheoryUtils.scaleNotes(ScaleCatalog.require("blues"), "C"),
                List.of("C", "Eb", "F", "F#", "G", "Bb"),
                List.of("1", "b3", "4", "#4", "5", "b7"));
        assertScale(TheoryUtils.scaleNotes(ScaleCatalog.require("dorian"), "D"),
                List.of("D", "E", "F", "G", "A", "B", "C"),
                List.of("1", "2", "b3", "4", "5", "6", "b7"));
    }

    @Test
    void choosesAccidentalPreference() {
        assertEquals("flat", TheoryUtils.accidentalPreference("Eb", null));
        assertEquals("sharp", TheoryUtils.accidentalPreference("C#", null));
        assertEquals("mixed", TheoryUtils.accidentalPreference("C", null));
        assertEquals("flat", TheoryUtils.accidentalPreference("C", "flat"));
        assertEquals("sharp", TheoryUtils.accidentalPreference("Eb", "sharp"));
    }

    @Test
    void describesChordRolesAndInversions() {
        assertEquals("根音", TheoryUtils.roleName("1"));
        assertEquals("大三音", TheoryUtils.roleName("3"));
        assertEquals("小三音", TheoryUtils.roleName("b3"));
        assertEquals("纯五音", TheoryUtils.roleName("5"));
        assertEquals("减五音", TheoryUtils.roleName("b5"));
        assertEquals("小七音", TheoryUtils.roleName("b7"));
        assertEquals("原位", TheoryUtils.inversionName("1"));
        assertTrue(TheoryUtils.inversionName("3").contains("第一转位"));
        assertTrue(TheoryUtils.inversionName("5").contains("第二转位"));
        assertTrue(TheoryUtils.inversionName("b7").contains("第三转位"));
    }

    @Test
    void chordCatalogHasExpectedQualities() {
        assertEquals(17, ScaleCatalog.all().size());
        assertEquals(24, ChordCatalog.all().size());
        assertNotNull(ChordCatalog.byId("major"));
        assertEquals("C", ChordCatalog.byId("major").symbol("C"));
        assertEquals("Cm", ChordCatalog.byId("minor").symbol("C"));
        assertEquals("G7", ChordCatalog.byId("dominant7").symbol("G"));
        assertEquals("Cdim7", ChordCatalog.byId("diminished7").symbol("C"));
        assertTrue(ChordCatalog.all().stream().anyMatch(q -> q.id().equals("sixNine")));
        assertThrows(IllegalArgumentException.class, () -> ScaleCatalog.require("nope"));
        assertFalse(ScaleCatalog.all().isEmpty());
    }

    private static void assertScale(List<ScaleNote> notes, List<String> names, List<String> degrees) {
        assertEquals(names.size(), notes.size(), "音阶音数不一致");
        for (int i = 0; i < names.size(); i++) {
            assertEquals(names.get(i), notes.get(i).name(), "第 " + (i + 1) + " 个音名");
            assertEquals(degrees.get(i), notes.get(i).degreeLabel(), "第 " + (i + 1) + " 个级数");
        }
    }
}
