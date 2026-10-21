package com.yinjie.web;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * REST API 冒烟测试：Spring 上下文 + JSON 序列化 + 参数校验。
 */
@SpringBootTest
@AutoConfigureMockMvc
class ApiIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    /** 关闭服务单独 mock，避免测试进程真的被结束。 */
    @MockitoBean
    private ShutdownService shutdownService;

    @Test
    void healthAndOptions() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"));

        mockMvc.perform(get("/api/options"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roots.length()").value(14))
                .andExpect(jsonPath("$.scales.length()").value(17))
                .andExpect(jsonPath("$.defaults.rootName").value("C"))
                .andExpect(jsonPath("$.fretRange.max").value(24));
    }

    @Test
    void fretboardView() throws Exception {
        mockMvc.perform(get("/api/fretboard").param("rootName", "C").param("scaleId", "major"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rootPitchClass").value(0))
                .andExpect(jsonPath("$.cells.length()").value(150))
                .andExpect(jsonPath("$.cells[0].noteName").value("E"))
                .andExpect(jsonPath("$.scale.notes.length()").value(7));

        mockMvc.perform(get("/api/fretboard")
                        .param("rootName", "F")
                        .param("scaleId", "major")
                        .param("fretFrom", "0")
                        .param("fretTo", "3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cells.length()").value(24))
                .andExpect(jsonPath("$.scale.notes[3].name").value("Bb"));
    }

    @Test
    void identifyChord() throws Exception {
        String body = """
                {"positions":[{"string":1,"fret":3},{"string":2,"fret":2},{"string":3,"fret":0},
                              {"string":4,"fret":1},{"string":5,"fret":0}],
                 "scaleId":"major","rootName":"C"}
                """;
        mockMvc.perform(post("/api/chord/identify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(5))
                .andExpect(jsonPath("$.chord.symbol").value("C"))
                .andExpect(jsonPath("$.chord.qualityId").value("major"))
                .andExpect(jsonPath("$.chord.tones.length()").value(3))
                .andExpect(jsonPath("$.hints").isArray());
    }

    @Test
    void emptyIdentifyIsValid() throws Exception {
        mockMvc.perform(post("/api/chord/identify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"positions\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0))
                .andExpect(jsonPath("$.chord").doesNotExist());
    }

    @Test
    void rejectsBadInput() throws Exception {
        mockMvc.perform(get("/api/fretboard").param("scaleId", "nope"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());

        mockMvc.perform(get("/api/fretboard").param("rootName", "H"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/chord/identify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"positions\":[{\"string\":0,\"fret\":30}]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void frameworkClientErrorsUseCorrectStatusCodes() throws Exception {
        // 畸形 JSON → 400，而不是 500
        mockMvc.perform(post("/api/chord/identify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{bad json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());

        // 用 GET 访问只接受 POST 的端点 → 405
        mockMvc.perform(get("/api/chord/identify"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.error").exists());

        // 查询参数类型错误 → 400
        mockMvc.perform(get("/api/fretboard").param("fretFrom", "abc"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").exists());

        // 未知静态资源 → 404 且为 JSON
        mockMvc.perform(get("/no-such-page.html"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void optionsExposeTuningPresets() throws Exception {
        mockMvc.perform(get("/api/options"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tunings.length()").value(6))
                .andExpect(jsonPath("$.defaultTuning").value("standard"))
                .andExpect(jsonPath("$.tunings[0].id").value("standard"))
                .andExpect(jsonPath("$.tunings[0].tuningParam").value("E2,A2,D3,G3,B3,E4"))
                .andExpect(jsonPath("$.tunings[1].id").value("drop-d"))
                .andExpect(jsonPath("$.tunings[1].strings.length()").value(6));
    }

    @Test
    void fretboardAcceptsCustomTuning() throws Exception {
        mockMvc.perform(get("/api/fretboard")
                        .param("rootName", "C")
                        .param("scaleId", "major")
                        .param("fretFrom", "0")
                        .param("fretTo", "0")
                        .param("tuning", "D2,A2,D3,G3,B3,E4"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.strings[0].openName").value("D"))
                .andExpect(jsonPath("$.strings[0].openMidi").value(38))
                .andExpect(jsonPath("$.cells[0].noteName").value("D"));
    }

    @Test
    void cagedShapesForCMajor() throws Exception {
        mockMvc.perform(get("/api/caged").param("rootName", "C").param("scaleId", "major"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rootName").value("C"))
                .andExpect(jsonPath("$.order[0]").value("C"))
                .andExpect(jsonPath("$.order[4]").value("D"))
                .andExpect(jsonPath("$.shapes.length()").value(5))
                .andExpect(jsonPath("$.shapes[0].id").value("C"))
                .andExpect(jsonPath("$.shapes[0].anchor.fret").value(3))
                .andExpect(jsonPath("$.shapes[0].chordTones.length()").value(5))
                .andExpect(jsonPath("$.shapes[0].cells[0].inScale").value(true));
    }

    @Test
    void shutdownEndpointAsksServiceToStop() throws Exception {
        org.mockito.Mockito.when(shutdownService.requestShutdown())
                .thenReturn("服务正在关闭，可以关闭本页面。");

        mockMvc.perform(post("/api/shutdown"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("shutting_down"))
                .andExpect(jsonPath("$.message").value("服务正在关闭，可以关闭本页面。"));

        org.mockito.Mockito.verify(shutdownService).requestShutdown();
    }
}
