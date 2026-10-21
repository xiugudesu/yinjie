package com.yinjie.theory;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 一种音阶 / 调式。interval 是与根音的半音数，formula 是对应的级数标签（如 "b3"）。
 */
public record ScaleType(String id,
                        String name,
                        String english,
                        String category,
                        List<Integer> intervals,
                        List<String> formula) {

    public List<Integer> pitchClasses(int rootPitchClass) {
        return intervals.stream().map(i -> Math.floorMod(rootPitchClass + i, 12)).collect(Collectors.toList());
    }

    public Set<Integer> pitchClassSet(int rootPitchClass) {
        return new LinkedHashSet<>(pitchClasses(rootPitchClass));
    }

    public boolean contains(int rootPitchClass, int pitchClass) {
        return pitchClassSet(rootPitchClass).contains(Math.floorMod(pitchClass, 12));
    }

    /** 级数标签的数字部分，例如 "b3" -> 3。 */
    public static int degreeNumber(String label) {
        int i = 0;
        while (i < label.length() && (label.charAt(i) == '#' || label.charAt(i) == 'b')) {
            i++;
        }
        return Integer.parseInt(label.substring(i));
    }
}
