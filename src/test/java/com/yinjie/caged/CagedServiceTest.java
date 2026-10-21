package com.yinjie.caged;

import com.yinjie.dto.CagedDtos.CagedResponse;
import com.yinjie.dto.CagedDtos.Cell;
import com.yinjie.dto.CagedDtos.ChordTone;
import com.yinjie.dto.CagedDtos.Shape;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * CAGED 系统 5 个手型的把位计算。
 */
class CagedServiceTest {

    private final CagedService service = new CagedService();

    @Test
    void cMajorProducesFiveShapesInOrder() {
        CagedResponse response = service.build("C", "major", null, 0, 24);
        assertEquals("C", response.rootName());
        assertEquals(0, response.rootPitchClass());
        assertEquals("major", response.scaleId());
        assertEquals(List.of("C", "A", "G", "E", "D"), response.order());
        assertEquals(5, response.shapes().size());
        assertEquals(List.of("C", "A", "G", "E", "D"),
                response.shapes().stream().map(Shape::id).collect(Collectors.toList()));
        assertEquals(TuningStandard.PARAM, response.tuning());
    }

    @Test
    void cShapeAnchorsAtFifthStringThirdFret() {
        Shape shape = shape("C", service.build("C", "major", null, 0, 24));
        assertEquals(1, shape.anchor().string());
        assertEquals(5, shape.anchor().stringNumber());
        assertEquals(3, shape.anchor().fret());
        assertEquals("C", shape.anchor().noteName());
        assertEquals(0, shape.anchor().pitchClass());
        assertTrue(shape.fretFrom() <= 0 && shape.fretTo() >= 4, "C 形状应覆盖 0-4 品");

        assertTrue(shape.cells().stream().anyMatch(cell ->
                cell.string() == 1 && cell.fret() == 3 && cell.degreeLabel().equals("1") && cell.isRoot()));
        assertTrue(shape.cells().stream().anyMatch(cell ->
                cell.string() == 2 && cell.fret() == 2 && cell.noteName().equals("E")));
        assertTrue(shape.cells().stream().anyMatch(cell ->
                cell.string() == 3 && cell.fret() == 0 && cell.noteName().equals("G")));

        Set<String> roles = shape.chordTones().stream().map(ChordTone::role).collect(Collectors.toSet());
        assertTrue(roles.containsAll(Set.of("根音", "大三音", "纯五音")));
        assertTrue(shape.cells().stream().allMatch(Cell::inScale));
        assertTrue(shape.description().contains("5 弦 3 品"));
    }

    @Test
    void eShapeAnchorsAtSixthStringEighthFret() {
        Shape shape = shape("E", service.build("C", "major", null, 0, 24));
        assertEquals(0, shape.anchor().string());
        assertEquals(6, shape.anchor().stringNumber());
        assertEquals(8, shape.anchor().fret());
        assertTrue(shape.chordTones().stream().anyMatch(tone ->
                tone.string() == 0 && tone.fret() == 8 && tone.role().equals("根音")));
    }

    @Test
    void fSharpMajorShiftsAnchors() {
        CagedResponse response = service.build("F#", "major", null, 0, 24);
        assertEquals(6, response.rootPitchClass());
        Shape cShape = shape("C", response);
        assertEquals(9, cShape.anchor().fret());
        assertEquals("F#", cShape.anchor().noteName());
        assertEquals(List.of("C", "A", "G", "E", "D"),
                response.shapes().stream().map(Shape::id).collect(Collectors.toList()));
    }

    @Test
    void respectsFretWindow() {
        CagedResponse narrow = service.build("C", "major", null, 0, 3);
        assertEquals(List.of("C", "A"),
                narrow.shapes().stream().map(Shape::id).collect(Collectors.toList()));
        assertTrue(narrow.shapes().stream().allMatch(shape -> shape.fretTo() <= 3));
    }

    @Test
    void customTuningMovesShapesAndCells() {
        CagedResponse response = service.build("C", "major", "D2,A2,D3,G3,B3,E4", 0, 24);
        assertEquals("D2,A2,D3,G3,B3,E4", response.tuning());

        Shape eShape = shape("E", response);
        assertEquals(0, eShape.anchor().string());
        assertEquals(10, eShape.anchor().fret());

        assertTrue(eShape.cells().stream().anyMatch(cell ->
                cell.string() == 0 && cell.fret() == 10 && cell.noteName().equals("C") && cell.isRoot()));
    }

    @Test
    void lowRootIsLiftedOneOctave() {
        // B 大调的 C 手型原始把位为负，整体 +12
        Shape cShape = shape("C", service.build("B", "major", null, 0, 24));
        assertEquals(11, cShape.anchor().pitchClass());
        assertTrue(cShape.anchor().fret() >= 0);
        assertTrue(cShape.fretFrom() >= 0 && cShape.fretTo() <= 24);
    }

    @Test
    void rejectsInvalidInput() {
        assertThrows(IllegalArgumentException.class,
                () -> service.build("H", "major", null, 0, 24));
        assertThrows(IllegalArgumentException.class,
                () -> service.build("C", "nope", null, 0, 24));
        assertThrows(IllegalArgumentException.class,
                () -> service.build("C", "major", null, 5, 3));
        assertThrows(IllegalArgumentException.class,
                () -> service.build("C", "major", "E2,A2", 0, 24));
    }

    @Test
    void shapeCellCountsAreConsistent() {
        CagedResponse response = service.build("C", "major", null, 0, 24);
        for (Shape shape : response.shapes()) {
            assertFalse(shape.cells().isEmpty(), "形状 " + shape.id() + " 不应为空");
            assertTrue(shape.fretFrom() >= 0 && shape.fretTo() <= 24);
            assertTrue(shape.fretFrom() <= shape.fretTo());
            for (Cell cell : shape.cells()) {
                assertTrue(cell.fret() >= shape.fretFrom() && cell.fret() <= shape.fretTo());
                assertTrue(cell.string() >= 0 && cell.string() <= 5);
            }
        }
    }

    private Shape shape(String id, CagedResponse response) {
        return response.shapes().stream()
                .filter(shape -> shape.id().equals(id))
                .findFirst()
                .orElseThrow();
    }

    /** 复用标准调弦参数，避免在测试里散落魔法字符串。 */
    private static final class TuningStandard {
        private static final String PARAM = com.yinjie.theory.Tuning.STANDARD.param();
    }
}
