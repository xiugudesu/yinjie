package com.yinjie.theory;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 一种和弦性质（大三、小七、挂四……）。
 * <p>intervals 是与根音的半音数（扩展音可以超过 12，例如九音 14），degrees 是对应级数标签，
 * letterSteps 是拼写音名时相对根音字母要走的字母步数（三度叠置为 0,2,4,6…，挂留和弦则不同）。</p>
 */
public record ChordQuality(String id,
                           String name,
                           String suffix,
                           String category,
                           List<Integer> intervals,
                           List<String> degrees,
                           List<Integer> letterSteps) {

    public int toneCount() {
        return intervals.size();
    }

    public Set<Integer> pitchClassSet(int rootPitchClass) {
        Set<Integer> pcs = new LinkedHashSet<>();
        for (int interval : intervals) {
            pcs.add(Math.floorMod(rootPitchClass + interval, 12));
        }
        return pcs;
    }

    /**
     * 可以省略而仍然成立的音（通常只有五音）：三和弦与七和弦经常省略五音。
     */
    public Set<Integer> omittablePitchClasses(int rootPitchClass) {
        Set<Integer> pcs = new LinkedHashSet<>();
        for (int i = 0; i < intervals.size(); i++) {
            if (isFifth(degrees.get(i))) {
                pcs.add(Math.floorMod(rootPitchClass + intervals.get(i), 12));
            }
        }
        return pcs;
    }

    private static boolean isFifth(String degreeLabel) {
        return "5".equals(degreeLabel) || "b5".equals(degreeLabel) || "#5".equals(degreeLabel);
    }

    public String symbol(String rootName) {
        return rootName + suffix;
    }
}
