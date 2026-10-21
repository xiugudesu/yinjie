package com.yinjie.chord;

import com.yinjie.dto.ChordDtos.ChordAlternative;
import com.yinjie.dto.ChordDtos.ChordInfo;
import com.yinjie.dto.ChordDtos.ChordTone;
import com.yinjie.dto.ChordDtos.IdentifyRequest;
import com.yinjie.dto.ChordDtos.IdentifyResponse;
import com.yinjie.dto.ChordDtos.Position;
import com.yinjie.dto.ChordDtos.SelectionNote;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 点选和弦识别：开放把位、封闭把位、转位斜杠和弦、同音异名与错误输入。
 */
class ChordIdentifierTest {

    private final ChordIdentifier identifier = new ChordIdentifier();

    @Test
    void identifiesOpenCShape() {
        IdentifyResponse response = identify("C", "major", 1, 3, 2, 2, 3, 0, 4, 1, 5, 0);
        assertEquals(5, response.count());
        ChordInfo chord = response.chord();
        assertNotNull(chord);
        assertEquals("C", chord.symbol());
        assertEquals("major", chord.qualityId());
        assertEquals("C", chord.rootName());
        assertEquals(0, chord.rootPitchClass());
        assertEquals("原位", chord.inversion());
        assertEquals("完整匹配", chord.matchType());
        assertEquals(100, chord.score());
        assertNotNull(chord.shapeHint());
        assertTrue(chord.shapeHint().contains("x32010"), "应识别出 C 开放把位指型: " + chord.shapeHint());
        assertEquals(List.of("C", "E", "G"),
                chord.tones().stream().map(ChordTone::noteName).toList());
        assertEquals(List.of("1", "3", "5"),
                chord.tones().stream().map(ChordTone::degreeLabel).toList());
        assertEquals(5, response.selection().size());
        assertTrue(response.alternatives().size() <= 6);
    }

    @Test
    void identifiesMinorAndSevenChords() {
        assertEquals("Am", identify("C", "major", 1, 0, 2, 2, 3, 2, 4, 1, 5, 0).chord().symbol());
        assertEquals("E", identify("G", "major", 0, 0, 1, 2, 2, 2, 3, 1, 4, 0, 5, 0).chord().symbol());
        assertEquals("D7", identify("C", "major", 2, 0, 3, 2, 4, 1, 5, 2).chord().symbol());
        assertEquals("A7", identify("C", "major", 1, 0, 2, 2, 3, 0, 4, 2, 5, 0).chord().symbol());
        assertEquals("Cmaj7", identify("C", "major", 1, 3, 2, 2, 3, 0, 4, 0, 5, 0).chord().symbol());
        assertEquals("Dm", identify("C", "major", 2, 0, 3, 2, 4, 3, 5, 1).chord().symbol());
    }

    @Test
    void identifiesPowerChord() {
        ChordInfo chord = identify("E", "natural-minor", 0, 0, 1, 2, 2, 2).chord();
        assertEquals("E5", chord.symbol());
        assertEquals("power", chord.qualityId());
        assertEquals(2, chord.tones().size());
        assertNotNull(chord.shapeHint());
        assertTrue(chord.shapeHint().contains("022"));
    }

    @Test
    void identifiesSlashChordAndInversion() {
        IdentifyResponse response = identify("C", "major", 0, 0, 1, 3, 2, 2, 3, 0, 4, 1, 5, 0);
        ChordInfo chord = response.chord();
        assertEquals("C/E", chord.symbol());
        assertEquals("E", chord.bass().noteName());
        assertTrue(chord.inversion().contains("第一转位"));
        assertTrue(chord.name().contains("E 在低音"));
    }

    @Test
    void spellsChordRootAccordingToKey() {
        // Eb 大调中指型 x68886，根音应拼写为 Eb 而不是 D#
        ChordInfo chord = identify("Eb", "major", 1, 6, 2, 8, 3, 8, 4, 8, 5, 6).chord();
        assertEquals("Eb", chord.symbol());
        assertEquals("Eb", chord.rootName());
        assertEquals("Eb", chord.tones().get(0).noteName());

        // F 大调中的 Fmaj7 x33210 必须拼写出 F A C E
        IdentifyResponse fResponse = identify("F", "major", 1, 3, 2, 3, 3, 2, 4, 1, 5, 0);
        assertTrue(fResponse.chord().symbol().startsWith("Fmaj7"));
        assertEquals(List.of("F", "A", "C", "E"),
                fResponse.chord().tones().stream().map(ChordTone::noteName).toList());
    }

    @Test
    void reportsMissingAndExtraTones() {
        // C 大三和弦只弹 C 与 E：缺五音，但五音可省略 → 判为 C 大三和弦（省略音）
        IdentifyResponse partial = identify("C", "major", 1, 3, 2, 2);
        assertNotNull(partial.chord());
        assertEquals("C", partial.chord().symbol());
        assertEquals("省略音", partial.chord().matchType());
        assertFalse(partial.chord().missing().isEmpty());
        assertTrue(partial.hints().stream().anyMatch(h -> h.contains("还缺")));

        // C 大三和弦 + 额外音 F
        IdentifyResponse extra = identify("C", "major", 1, 3, 2, 2, 3, 0, 4, 1, 5, 0, 4, 6);
        assertNotNull(extra.chord());
        assertFalse(extra.chord().extra().isEmpty());
    }

    @Test
    void listsAlternativesForAmbiguousSelection() {
        // E 与 B 两个音：E5 完整匹配，E 大三和弦应作为替代候选出现（缺三音）
        IdentifyResponse response = identify("E", "natural-minor", 0, 0, 1, 2);
        assertEquals("E5", response.chord().symbol());
        List<String> symbols = new ArrayList<>();
        for (ChordAlternative alternative : response.alternatives()) {
            symbols.add(alternative.symbol());
        }
        assertFalse(symbols.isEmpty());
        assertTrue(symbols.stream().anyMatch(s -> s.startsWith("E") || s.startsWith("B5")));
    }

    @Test
    void handlesEmptyAndSingleNoteSelections() {
        IdentifyResponse empty = identify("C", "major");
        assertEquals(0, empty.count());
        assertNull(empty.chord());
        assertFalse(empty.hints().isEmpty());

        IdentifyResponse single = identify("C", "major", 2, 0);
        assertEquals(1, single.count());
        assertNull(single.chord());
        SelectionNote note = single.selection().get(0);
        assertEquals("D", note.noteName());
        assertEquals("2", note.scaleDegreeLabel());
        assertTrue(note.inScale());
        assertFalse(single.hints().isEmpty());
    }

    @Test
    void marksSelectionAgainstScale() {
        IdentifyResponse response = identify("C", "major", 0, 1, 3, 1);
        SelectionNote fNote = response.selection().stream()
                .filter(n -> n.string() == 0 && n.fret() == 1)
                .findFirst().orElseThrow();
        assertEquals("F", fNote.noteName());
        assertTrue(fNote.inScale());
        SelectionNote gSharp = response.selection().stream()
                .filter(n -> n.string() == 3 && n.fret() == 1)
                .findFirst().orElseThrow();
        assertEquals("Ab", gSharp.noteName());
        assertFalse(gSharp.inScale());
        assertEquals("", gSharp.scaleDegreeLabel());
    }

    @Test
    void defaultsToCMajorWhenScaleOmitted() {
        IdentifyRequest request = new IdentifyRequest(List.of(
                new Position(1, 3), new Position(2, 2), new Position(3, 0),
                new Position(4, 1), new Position(5, 0)), null, null, null);
        IdentifyResponse response = identifier.identify(request);
        assertEquals("major", response.scaleId());
        assertEquals("C", response.scaleRootName());
        assertEquals("C", response.chord().symbol());
    }

    @Test
    void validatesPositions() {
        assertThrows(IllegalArgumentException.class,
                () -> identify("C", "major", 0, 25));
        assertThrows(IllegalArgumentException.class,
                () -> identify("C", "major", 6, 3));
        assertThrows(IllegalArgumentException.class,
                () -> identify("C", "nope", 1, 3));
    }

    @Test
    void usesCustomTuningForPitchCalculation() {
        // Drop D：6 弦空弦是 D2，5 弦 0 品 A2，4 弦 0 品 D3 → D5 强力和弦
        IdentifyRequest request = new IdentifyRequest(List.of(
                new Position(0, 0), new Position(1, 0), new Position(2, 0)),
                "major", "C", "D2,A2,D3,G3,B3,E4");
        IdentifyResponse response = identifier.identify(request);

        SelectionNote lowD = response.selection().stream()
                .filter(note -> note.string() == 0 && note.fret() == 0)
                .findFirst().orElseThrow();
        assertEquals("D", lowD.noteName());
        assertEquals(38, lowD.midi());

        assertEquals("D5", response.chord().symbol());
        assertEquals(0, response.chord().bass().string());
        assertEquals(6, response.chord().bass().stringNumber());
        assertEquals(0, response.chord().bass().fret());
        assertEquals(2, response.chord().bass().pitchClass());
        assertEquals("D", response.chord().bass().noteName());
    }

    @Test
    void standardTuningKeepsKnownShapeHints() {
        IdentifyResponse response = identify("C", "major", 1, 3, 2, 2, 3, 0, 4, 1, 5, 0);
        assertEquals("C 大三和弦开放把位（x32010）", response.chord().shapeHint());
    }

    private IdentifyResponse identify(String rootName, String scaleId, int... stringFretPairs) {
        List<Position> positions = new ArrayList<>();
        for (int i = 0; i + 1 < stringFretPairs.length; i += 2) {
            positions.add(new Position(stringFretPairs[i], stringFretPairs[i + 1]));
        }
        return identifier.identify(new IdentifyRequest(positions, scaleId, rootName, null));
    }
}
