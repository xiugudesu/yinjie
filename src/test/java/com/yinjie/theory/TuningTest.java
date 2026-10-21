package com.yinjie.theory;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 调弦解析与音高推算（v2 自定义特殊调弦的基础）。
 */
class TuningTest {

    @Test
    void nullOrBlankMeansStandard() {
        for (String param : new String[]{null, "", "   "}) {
            Tuning tuning = Tuning.parse(param);
            assertTrue(tuning.isStandard());
            assertEquals(Tuning.STANDARD_PARAM, tuning.param());
            assertArrayEquals(new int[]{40, 45, 50, 55, 59, 64}, tuning.openMidiArray());
        }
    }

    @Test
    void parsesDropD() {
        Tuning tuning = Tuning.parse("D2,A2,D3,G3,B3,E4");
        assertFalse(tuning.isStandard());
        assertArrayEquals(new int[]{38, 45, 50, 55, 59, 64}, tuning.openMidiArray());
        assertEquals("D", tuning.openName(0));
        assertEquals("D2,A2,D3,G3,B3,E4", tuning.param());
        assertEquals(40, tuning.midiAt(0, 2));
    }

    @Test
    void parsesFlatsAndUnicodeAccidentals() {
        Tuning flat = Tuning.parse("Eb2,Ab2,Db3,Gb3,Bb3,Eb4");
        assertArrayEquals(new int[]{39, 44, 49, 54, 58, 63}, flat.openMidiArray());
        assertEquals("Eb2,Ab2,Db3,Gb3,Bb3,Eb4", flat.param());

        Tuning unicode = Tuning.parse("E♭2,A♭2,D♭3,G♭3,B♭3,E♭4");
        assertEquals("Eb2,Ab2,Db3,Gb3,Bb3,Eb4", unicode.param());
    }

    @Test
    void parsesSharps() {
        Tuning tuning = Tuning.parse("F#2,B2,E3,A3,C#4,F#4");
        assertArrayEquals(new int[]{42, 47, 52, 57, 61, 66}, tuning.openMidiArray());
        assertEquals("F#2,B2,E3,A3,C#4,F#4", tuning.param());
    }

    @Test
    void rejectsMalformedTuning() {
        assertThrows(IllegalArgumentException.class, () -> Tuning.parse("E2,A2,D3"));
        assertThrows(IllegalArgumentException.class, () -> Tuning.parse("H2,A2,D3,G3,B3,E4"));
        assertThrows(IllegalArgumentException.class, () -> Tuning.parse("E,A2,D3,G3,B3,E4"));
        assertThrows(IllegalArgumentException.class, () -> Tuning.parse("E9,A2,D3,G3,B3,E4"));
        assertThrows(IllegalArgumentException.class, () -> Tuning.parse("Ex,A2,D3,G3,B3,E4"));
        assertThrows(IllegalArgumentException.class, () -> Tuning.parse("E2,A2,D3,G3,B3,"));
    }

    @Test
    void ofMidiBuildsSharpNames() {
        Tuning tuning = Tuning.ofMidi(new int[]{38, 45, 50, 55, 59, 64});
        assertEquals("D2,A2,D3,G3,B3,E4", tuning.param());
        assertEquals("D", tuning.openName(0));
        assertEquals(38, tuning.openMidi(0));
    }

    @Test
    void openParamKeepsOctave() {
        Tuning tuning = Tuning.parse("C1,E2,A2,D3,G3,C4");
        assertEquals("C1", tuning.openParam(0));
        assertEquals("C4", tuning.openParam(5));
        assertEquals(24, tuning.openMidi(0));
        assertEquals(60, tuning.openMidi(5));
    }

    @Test
    void validatesFretAndStringBounds() {
        Tuning tuning = Tuning.STANDARD;
        assertEquals(88, tuning.midiAt(5, 24));
        assertThrows(IllegalArgumentException.class, () -> tuning.midiAt(5, 25));
        assertThrows(IllegalArgumentException.class, () -> tuning.midiAt(-1, 0));
        assertThrows(IllegalArgumentException.class, () -> tuning.midiAt(6, 0));
        assertThrows(IllegalArgumentException.class, () -> tuning.openMidi(6));
    }
}
