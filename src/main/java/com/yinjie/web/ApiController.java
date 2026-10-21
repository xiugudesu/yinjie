package com.yinjie.web;

import com.yinjie.caged.CagedService;
import com.yinjie.chord.ChordIdentifier;
import com.yinjie.dto.CagedDtos.CagedResponse;
import com.yinjie.dto.ChordDtos.IdentifyRequest;
import com.yinjie.dto.ChordDtos.IdentifyResponse;
import com.yinjie.dto.FretboardDtos.FretboardResponse;
import com.yinjie.dto.OptionsDtos.OptionsResponse;
import com.yinjie.fretboard.FretboardService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * yinjie 的 REST API。前端（src/main/resources/static）通过同源请求调用。
 */
@RestController
@RequestMapping("/api")
public class ApiController {

    private final FretboardService fretboardService;
    private final ChordIdentifier chordIdentifier;
    private final CagedService cagedService;
    private final ShutdownService shutdownService;

    public ApiController(FretboardService fretboardService,
                         ChordIdentifier chordIdentifier,
                         CagedService cagedService,
                         ShutdownService shutdownService) {
        this.fretboardService = fretboardService;
        this.chordIdentifier = chordIdentifier;
        this.cagedService = cagedService;
        this.shutdownService = shutdownService;
    }

    @GetMapping("/health")
    public Map<String, String> health() {
        return Map.of("status", "ok", "app", "yinjie");
    }

    /** 根音、音阶类型、调弦预设、品格范围等静态选项。 */
    @GetMapping("/options")
    public OptionsResponse options() {
        return fretboardService.options();
    }

    /**
     * 指板音阶视图：每个弦/品格的音名、级数、是否属于音阶。
     *
     * @param tuning 可选调弦参数（6 个「音名+八度」，6 弦→1 弦），省略 = 标准调弦
     */
    @GetMapping("/fretboard")
    public FretboardResponse fretboard(@RequestParam(defaultValue = "C") String rootName,
                                       @RequestParam(defaultValue = "major") String scaleId,
                                       @RequestParam(required = false) Integer fretFrom,
                                       @RequestParam(required = false) Integer fretTo,
                                       @RequestParam(required = false) String accidental,
                                       @RequestParam(required = false) String tuning) {
        return fretboardService.build(rootName, scaleId, fretFrom, fretTo, accidental, tuning);
    }

    /** CAGED 系统的 5 个把位形状（音阶模式使用）。 */
    @GetMapping("/caged")
    public CagedResponse caged(@RequestParam(defaultValue = "C") String rootName,
                               @RequestParam(defaultValue = "major") String scaleId,
                               @RequestParam(required = false) Integer fretFrom,
                               @RequestParam(required = false) Integer fretTo,
                               @RequestParam(required = false) String tuning) {
        return cagedService.build(rootName, scaleId, tuning, fretFrom, fretTo);
    }

    /** 根据点选的品格（弦号 0-5、品 0-24）识别和弦。 */
    @PostMapping("/chord/identify")
    public IdentifyResponse identify(@RequestBody(required = false) IdentifyRequest request) {
        return chordIdentifier.identify(request == null
                ? new IdentifyRequest(List.of(), null, null, null)
                : request);
    }

    /** 页面「退出」按钮：关闭服务（响应返回后约 0.5 秒进程退出）。 */
    @PostMapping("/shutdown")
    public Map<String, String> shutdown() {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("status", "shutting_down");
        body.put("message", shutdownService.requestShutdown());
        return body;
    }
}
