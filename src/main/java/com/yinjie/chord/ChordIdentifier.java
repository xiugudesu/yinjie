package com.yinjie.chord;

import com.yinjie.dto.ChordDtos.IdentifyRequest;
import com.yinjie.dto.ChordDtos.IdentifyResponse;
import com.yinjie.dto.ChordDtos.Position;
import com.yinjie.dto.ChordDtos.SelectionNote;
import com.yinjie.dto.ChordDtos.ChordAlternative;
import com.yinjie.dto.ChordDtos.ChordInfo;
import com.yinjie.dto.ChordDtos.ChordTone;
import com.yinjie.dto.ChordDtos.Bass;
import com.yinjie.dto.FretboardDtos.ScaleNote;
import com.yinjie.fretboard.FretboardService;
import com.yinjie.theory.ChordCatalog;
import com.yinjie.theory.ChordQuality;
import com.yinjie.theory.Notes;
import com.yinjie.theory.ScaleCatalog;
import com.yinjie.theory.ScaleType;
import com.yinjie.theory.TheoryUtils;
import com.yinjie.theory.Tuning;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 根据指板上点选的品格（弦号 + 品）识别和弦。
 * <p>评分思路：枚举 12 个根音 × 全部和弦性质，把"缺少的音"和"多余音"作为扣分，
 * 再对"根音是否被弹到""低音是否就是根音"加分；三和弦/七和弦允许省略五音。
 * 同分时优先音数更少、目录顺序更靠前的性质（大三 → 小三 → …）。</p>
 */
@Service
public class ChordIdentifier {

    private static final int MIN_SCORE = 45;
    private static final int FALLBACK_SCORE = 55;
    private static final int ALTERNATIVE_SCORE = 60;
    private static final int MAX_ALTERNATIVES = 6;
    private static final int MAX_POSITIONS = 12;

    private record Candidate(ChordQuality quality,
                             int rootPc,
                             Set<Integer> required,
                             List<Integer> missing,
                             List<Integer> extra,
                             boolean allowed,
                             int rawScore,
                             int order) {
    }

    public IdentifyResponse identify(IdentifyRequest request) {
        String scaleId = request == null || request.scaleId() == null || request.scaleId().isBlank()
                ? "major" : request.scaleId().trim();
        String scaleRootName = request == null || request.rootName() == null || request.rootName().isBlank()
                ? "C" : request.rootName().trim();
        ScaleType scale = ScaleCatalog.require(scaleId);
        try {
            Notes.parse(scaleRootName);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("无效的根音：" + scaleRootName);
        }
        String preference = TheoryUtils.accidentalPreference(scaleRootName, null);
        Tuning tuning = Tuning.parse(request == null ? null : request.tuning());

        List<Position> positions = sanitize(request == null ? null : request.positions());
        int count = positions.size();

        List<ScaleNote> scaleNotes = TheoryUtils.scaleNotes(scale, scaleRootName);
        Map<Integer, ScaleNote> scaleNoteByPc = new LinkedHashMap<>();
        for (ScaleNote note : scaleNotes) {
            scaleNoteByPc.putIfAbsent(note.pitchClass(), note);
        }

        LinkedHashSet<Integer> selectedPcs = new LinkedHashSet<>();
        for (Position position : positions) {
            selectedPcs.add(midiOf(tuning, position) % 12);
        }
        Position bassPos = positions.stream()
                .min(Comparator.comparingInt(position -> midiOf(tuning, position)))
                .orElse(null);
        int bassPc = bassPos == null ? -1 : midiOf(tuning, bassPos) % 12;

        Candidate best = null;
        List<Candidate> ranked = List.of();
        if (count >= 2 && selectedPcs.size() >= 2) {
            ranked = rankCandidates(selectedPcs, bassPc);
            best = ranked.stream().filter(c -> c.rawScore() >= MIN_SCORE).findFirst().orElse(null);
            if (best == null) {
                best = ranked.stream().filter(c -> c.rawScore() >= FALLBACK_SCORE).findFirst().orElse(null);
            }
        }

        ChordInfo chord = best == null
                ? null
                : buildChord(best, positions, bassPos, selectedPcs, preference, scaleNoteByPc, tuning);

        List<ChordAlternative> alternatives = new ArrayList<>();
        if (best != null) {
            Map<String, ChordAlternative> seen = new LinkedHashMap<>();
            for (Candidate candidate : ranked) {
                if (candidate == best) {
                    continue;
                }
                if (candidate.rawScore() < ALTERNATIVE_SCORE) {
                    continue;
                }
                if (!candidate.allowed() && !candidate.missing().isEmpty()) {
                    continue;
                }
                ChordAlternative alternative = buildAlternative(candidate, bassPc, preference, scaleNoteByPc);
                seen.putIfAbsent(alternative.symbol(), alternative);
                if (seen.size() >= MAX_ALTERNATIVES) {
                    break;
                }
            }
            alternatives.addAll(seen.values());
        }

        List<SelectionNote> selection = buildSelection(positions, best, preference, scaleNoteByPc, tuning);

        return new IdentifyResponse(
                count,
                scale.id(),
                scale.name(),
                scaleRootName,
                scaleNotes.stream().map(ScaleNote::name).toList(),
                selection,
                chord,
                alternatives,
                buildHints(count, selectedPcs.size(), best, alternatives, selection, preference, scaleNoteByPc)
        );
    }

    // ------------------------------------------------------------------
    // 候选和弦评分
    // ------------------------------------------------------------------

    private List<Candidate> rankCandidates(Set<Integer> selectedPcs, int bassPc) {
        List<ChordQuality> qualities = ChordCatalog.all();
        List<Candidate> candidates = new ArrayList<>();
        for (int rootPc = 0; rootPc < 12; rootPc++) {
            for (int order = 0; order < qualities.size(); order++) {
                ChordQuality quality = qualities.get(order);
                Set<Integer> required = quality.pitchClassSet(rootPc);

                List<Integer> missing = new ArrayList<>();
                for (int pc : required) {
                    if (!selectedPcs.contains(pc)) {
                        missing.add(pc);
                    }
                }
                List<Integer> extra = new ArrayList<>();
                for (int pc : selectedPcs) {
                    if (!required.contains(pc)) {
                        extra.add(pc);
                    }
                }
                Set<Integer> omittable = quality.omittablePitchClasses(rootPc);
                boolean allowed = missing.stream().allMatch(omittable::contains);

                int raw = 92 - 12 * missing.size() - 20 * extra.size() - (allowed ? 0 : 10);
                if (selectedPcs.contains(rootPc)) {
                    raw += 4;
                }
                if (rootPc == bassPc) {
                    raw += 4;
                }
                if (raw < 30) {
                    continue;
                }
                candidates.add(new Candidate(quality, rootPc, required, missing, extra, allowed, raw, order));
            }
        }
        candidates.sort(Comparator
                .comparingInt(Candidate::rawScore).reversed()
                .thenComparingInt(c -> c.extra().size())
                .thenComparingInt(c -> c.missing().size())
                .thenComparingInt(c -> c.quality().toneCount())
                .thenComparingInt(Candidate::order));
        return candidates;
    }

    // ------------------------------------------------------------------
    // 响应组装
    // ------------------------------------------------------------------

    private List<SelectionNote> buildSelection(List<Position> positions,
                                               Candidate best,
                                               String preference,
                                               Map<Integer, ScaleNote> scaleNoteByPc,
                                               Tuning tuning) {
        List<Position> ordered = new ArrayList<>(positions);
        ordered.sort(Comparator.comparingInt(Position::string).thenComparingInt(Position::fret));

        List<SelectionNote> selection = new ArrayList<>();
        for (Position position : ordered) {
            int midi = midiOf(tuning, position);
            int pc = midi % 12;
            ScaleNote scaleNote = scaleNoteByPc.get(pc);
            boolean inScale = scaleNote != null;
            String chordRole = "";
            String chordRoleName = "";
            if (best != null && best.required().contains(pc)) {
                chordRole = degreeLabelForPc(best.quality(), best.rootPc(), pc);
                chordRoleName = chordRole == null ? "" : TheoryUtils.roleName(chordRole);
            }
            selection.add(new SelectionNote(
                    position.string(),
                    FretboardService.stringNumber(position.string()),
                    position.fret(),
                    midi,
                    inScale ? scaleNote.name() : Notes.spelling(pc, preference),
                    pc,
                    inScale,
                    inScale ? scaleNote.degreeLabel() : "",
                    chordRole == null ? "" : chordRole,
                    chordRoleName
            ));
        }
        return selection;
    }

    private ChordInfo buildChord(Candidate best,
                                 List<Position> positions,
                                 Position bassPos,
                                 Set<Integer> selectedPcs,
                                 String preference,
                                 Map<Integer, ScaleNote> scaleNoteByPc,
                                 Tuning tuning) {
        ChordQuality quality = best.quality();
        String rootName = chordRootName(best.rootPc(), preference, scaleNoteByPc);
        Notes.Spelled rootSpelled = Notes.parse(rootName);

        List<ChordTone> tones = new ArrayList<>();
        for (int i = 0; i < quality.intervals().size(); i++) {
            int interval = quality.intervals().get(i);
            String degreeLabel = quality.degrees().get(i);
            int letter = Math.floorMod(rootSpelled.letterIndex() + quality.letterSteps().get(i), 7);
            int pc = Math.floorMod(best.rootPc() + interval, 12);
            tones.add(new ChordTone(
                    degreeLabel,
                    Notes.spell(pc, letter),
                    pc,
                    TheoryUtils.roleName(degreeLabel),
                    selectedPcs.contains(pc)
            ));
        }

        int bassPc = bassPos == null ? -1 : midiOf(tuning, bassPos) % 12;
        String bassNoteName = bassPc < 0 ? "" : noteName(bassPc, preference, scaleNoteByPc);
        String bassDegree = bassPc < 0 ? null : degreeLabelForPc(quality, best.rootPc(), bassPc);
        String inversion;
        if (bassPc == best.rootPc()) {
            inversion = "原位";
        } else if (bassDegree != null) {
            inversion = TheoryUtils.inversionName(bassDegree);
        } else {
            inversion = "斜杠和弦（低音非和弦音）";
        }

        String symbol = rootName + quality.suffix();
        if (bassPc >= 0 && bassPc != best.rootPc()) {
            symbol += "/" + bassNoteName;
        }
        String name = rootName + " " + quality.name();
        if (bassPc >= 0 && bassPc != best.rootPc()) {
            name += "（" + bassNoteName + " 在低音）";
        }

        List<String> missingLabels = new ArrayList<>();
        for (int pc : best.missing()) {
            String degreeLabel = degreeLabelForPc(quality, best.rootPc(), pc);
            String toneName = toneName(tones, pc);
            missingLabels.add((degreeLabel == null ? "?" : degreeLabel) + "（" + toneName + "）");
        }
        List<String> extraNames = new ArrayList<>();
        for (int pc : best.extra()) {
            extraNames.add(noteName(pc, preference, scaleNoteByPc));
        }

        String matchType;
        if (best.extra().isEmpty() && best.missing().isEmpty()) {
            matchType = "完整匹配";
        } else if (best.extra().isEmpty() && best.allowed()) {
            matchType = "省略音";
        } else {
            matchType = "近似匹配";
        }

        Bass bass = bassPos == null ? null : new Bass(
                bassPos.string(),
                FretboardService.stringNumber(bassPos.string()),
                bassPos.fret(),
                bassNoteName,
                bassPc,
                bassDegree == null ? "额外低音" : TheoryUtils.roleName(bassDegree)
        );

        StringBuilder description = new StringBuilder();
        description.append(rootName).append(" ").append(quality.name()).append("，").append(inversion).append("。");
        description.append("构成音：");
        description.append(String.join("、", tones.stream()
                .map(t -> t.noteName() + "（" + t.degreeLabel() + "）")
                .toList()));
        description.append("。");
        if (bassPos != null) {
            description.append("最低音为 ").append(FretboardService.stringNumber(bassPos.string()))
                    .append(" 弦 ").append(bassPos.fret()).append(" 品的 ").append(bassNoteName).append("。");
        }
        if (!missingLabels.isEmpty()) {
            description.append("尚未弹奏：").append(String.join("、", missingLabels)).append("。");
        }
        if (!extraNames.isEmpty()) {
            description.append("额外音：").append(String.join("、", extraNames)).append("。");
        }

        return new ChordInfo(
                symbol,
                name,
                rootName,
                best.rootPc(),
                quality.id(),
                quality.name(),
                quality.suffix(),
                tones,
                bass,
                inversion,
                matchType,
                Math.min(100, best.rawScore()),
                missingLabels,
                extraNames,
                description.toString(),
                tuning.isStandard() ? KnownShapes.match(positions) : null
        );
    }

    private ChordAlternative buildAlternative(Candidate candidate,
                                              int bassPc,
                                              String preference,
                                              Map<Integer, ScaleNote> scaleNoteByPc) {
        ChordQuality quality = candidate.quality();
        String rootName = chordRootName(candidate.rootPc(), preference, scaleNoteByPc);
        String bassDegree = bassPc < 0 ? null : degreeLabelForPc(quality, candidate.rootPc(), bassPc);
        String bassNoteName = bassPc < 0 ? "" : noteName(bassPc, preference, scaleNoteByPc);

        String inversion;
        if (bassPc == candidate.rootPc()) {
            inversion = "原位";
        } else if (bassDegree != null) {
            inversion = TheoryUtils.inversionName(bassDegree);
        } else {
            inversion = "斜杠和弦";
        }
        String symbol = rootName + quality.suffix();
        if (bassPc >= 0 && bassPc != candidate.rootPc() && bassDegree != null) {
            symbol += "/" + bassNoteName;
        }

        List<String> missingLabels = new ArrayList<>();
        for (int pc : candidate.missing()) {
            String degreeLabel = degreeLabelForPc(quality, candidate.rootPc(), pc);
            missingLabels.add(degreeLabel == null ? "?" : degreeLabel);
        }
        List<String> extraNames = new ArrayList<>();
        for (int pc : candidate.extra()) {
            extraNames.add(noteName(pc, preference, scaleNoteByPc));
        }

        String matchType;
        if (candidate.extra().isEmpty() && candidate.missing().isEmpty()) {
            matchType = "完整匹配";
        } else if (candidate.extra().isEmpty() && candidate.allowed()) {
            matchType = "省略音";
        } else {
            matchType = "近似匹配";
        }

        return new ChordAlternative(
                symbol,
                rootName + " " + quality.name(),
                rootName,
                quality.name(),
                matchType,
                Math.min(100, candidate.rawScore()),
                missingLabels,
                extraNames,
                inversion
        );
    }

    private List<String> buildHints(int count,
                                    int distinctPcCount,
                                    Candidate best,
                                    List<ChordAlternative> alternatives,
                                    List<SelectionNote> selection,
                                    String preference,
                                    Map<Integer, ScaleNote> scaleNoteByPc) {
        List<String> hints = new ArrayList<>();
        if (count == 0) {
            hints.add("在指板上点击品格来选音：至少两个不同音高即可识别和弦。");
            hints.add("键盘：← → ↑ ↓ 移动焦点，空格 / 回车选音，Esc 清空。");
            return hints;
        }
        if (count == 1) {
            hints.add("当前只选了一个音（" + selection.get(0).noteName() + "），再选一个不同音高的音试试。");
            return hints;
        }
        if (distinctPcCount < 2) {
            hints.add("选中的音高相同，无法构成和弦，请再点选其他品格。");
            return hints;
        }
        if (best == null) {
            hints.add("这组音不构成常用和弦，试试增减音或换个把位。");
            return hints;
        }
        if (!best.missing().isEmpty()) {
            hints.add("还缺 " + String.join("、", best.missing().stream()
                    .map(pc -> {
                        String degreeLabel = degreeLabelForPc(best.quality(), best.rootPc(), pc);
                        return (degreeLabel == null ? "?" : degreeLabel) + "（"
                                + noteName(pc, preference, scaleNoteByPc) + "）";
                    }).toList()) + "，补上这些音可得到完整和弦。");
        }
        if (!best.extra().isEmpty()) {
            hints.add("额外音 " + String.join("、", best.extra().stream()
                    .map(pc -> noteName(pc, preference, scaleNoteByPc)).toList())
                    + " 可能是经过音或色彩音，去掉它可能更清晰。");
        }
        if (!alternatives.isEmpty()) {
            hints.add("同音异名 / 替代候选：" + String.join("、",
                    alternatives.stream().map(ChordAlternative::symbol).toList()) + "。");
        }
        hints.add("提示：Esc 可清空全部选择。");
        return hints;
    }

    // ------------------------------------------------------------------
    // 工具方法
    // ------------------------------------------------------------------

    private List<Position> sanitize(List<Position> raw) {
        if (raw == null || raw.isEmpty()) {
            return List.of();
        }
        List<Position> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Position position : raw) {
            if (position == null) {
                continue;
            }
            if (position.string() < 0 || position.string() > 5) {
                throw new IllegalArgumentException("弦序号必须在 0-5 之间: " + position.string());
            }
            if (position.fret() < FretboardService.MIN_FRET || position.fret() > FretboardService.MAX_FRET) {
                throw new IllegalArgumentException("品位数必须在 0-24 之间: " + position.fret());
            }
            if (seen.add(position.string() + ":" + position.fret())) {
                result.add(position);
            }
            if (result.size() >= MAX_POSITIONS) {
                break;
            }
        }
        return result;
    }

    private int midiOf(Tuning tuning, Position position) {
        return tuning.openMidi(position.string()) + position.fret();
    }

    private String chordRootName(int rootPc, String preference, Map<Integer, ScaleNote> scaleNoteByPc) {
        ScaleNote scaleNote = scaleNoteByPc.get(rootPc);
        return scaleNote != null ? scaleNote.name() : Notes.spelling(rootPc, preference);
    }

    private String noteName(int pc, String preference, Map<Integer, ScaleNote> scaleNoteByPc) {
        ScaleNote scaleNote = scaleNoteByPc.get(pc);
        return scaleNote != null ? scaleNote.name() : Notes.spelling(pc, preference);
    }

    private String degreeLabelForPc(ChordQuality quality, int rootPc, int pc) {
        int normalized = Math.floorMod(pc, 12);
        for (int i = 0; i < quality.intervals().size(); i++) {
            if (Math.floorMod(rootPc + quality.intervals().get(i), 12) == normalized) {
                return quality.degrees().get(i);
            }
        }
        return null;
    }

    private String toneName(List<ChordTone> tones, int pc) {
        for (ChordTone tone : tones) {
            if (tone.pitchClass() == pc) {
                return tone.noteName();
            }
        }
        return Notes.spelling(pc, "mixed");
    }
}
