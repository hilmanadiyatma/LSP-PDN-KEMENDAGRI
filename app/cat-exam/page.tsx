"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ExamInfo = {
  id: number;
  name: string;
  description: string | null;
  duration_minutes: number;
  passing_score: number;
};

type ScheduleInfo = {
  id: number;
  competency_test_id: number;
  name: string;
  description: string | null;
  start_at: string;
  end_at: string;
};

type Question = {
  id: number;
  competency_test_id: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  difficulty: string | null;
  competency_unit: string | null;
  score: number;
  question_order: number;
};

type AnswerMap = Record<number, string>;

type StartExamResult = {
  success: boolean;
  mode: string;
  attempt_id: number;
  started_at: string;
  server_now: string;
  remaining_seconds: number;
  violation_count: number;
  disqualified: boolean;
  disqualification_reason: string | null;
  attempt_status: string;
  session_token?: string;
};

type SaveAnswerResult = {
  success: boolean;
  is_correct: boolean;
  score: number;
  answered_questions: number;
  remaining_seconds: number;
  server_now: string;
};

type SubmitResult = {
  success: boolean;
  status: string;
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
  score: number;
  passing_score: number;
  passed: boolean;
  remaining_seconds: number;
};

type ViolationResult = {
  success: boolean;
  violation_count: number;
  disqualified: boolean;
  reason: string | null;
  attempt_status: string;
};

export default function CatExamPage() {
  const searchParams = useSearchParams();

  const scheduleIdParam =
    searchParams.get("schedule_id");

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");

  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [schedule, setSchedule] =
    useState<ScheduleInfo | null>(null);

  const [questions, setQuestions] =
    useState<Question[]>([]);

  const [answers, setAnswers] =
    useState<AnswerMap>({});

  const [attemptId, setAttemptId] =
    useState<number | null>(null);

  const [sessionToken, setSessionToken] =
    useState<string | null>(null);

  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);

  const [remainingSeconds, setRemainingSeconds] =
    useState(0);

  const [violationCount, setViolationCount] =
    useState(0);

  const [disqualified, setDisqualified] =
    useState(false);

  const [disqualificationReason, setDisqualificationReason] =
    useState("");

  const [showWarning, setShowWarning] =
    useState(false);

  const [warningMessage, setWarningMessage] =
    useState("");

  const [currentIndex, setCurrentIndex] =
    useState(0);

  const initialLoadRef = useRef(false);
  const violationProcessingRef =
    useRef(false);

  const lastViolationTimeRef =
    useRef(0);

  const submitProcessingRef =
    useRef(false);

  const currentQuestion =
    questions[currentIndex];

  const answeredCount = useMemo(
    () => Object.keys(answers).length,
    [answers]
  );

  const progress = useMemo(() => {
    if (questions.length === 0) return 0;

    return Math.round(
      ((currentIndex + 1) /
        questions.length) *
        100
    );
  }, [
    currentIndex,
    questions.length,
  ]);

  /*
   * ============================================================
   * AUTH
   * ============================================================
   */

  const ensureAuthenticated =
    useCallback(async () => {
      const {
        data,
        error,
      } = await supabase.auth.getUser();

      if (error || !data.user) {
        throw new Error(
          "Sesi login tidak ditemukan."
        );
      }

      return data.user;
    }, []);

  /*
   * ============================================================
   * LOAD SCHEDULE
   * ============================================================
   */

  const loadSchedule =
  useCallback(async () => {
    const user =
      await ensureAuthenticated();

    const {
      data: participant,
      error: participantError,
    } = await supabase
      .from("participants")
      .select("id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (participantError) {
      throw participantError;
    }

    if (!participant) {
      throw new Error(
        "Data peserta tidak ditemukan."
      );
    }

    /*
     * ============================================================
     * SCHEDULE ID DARI URL
     * ============================================================
     *
     * Contoh:
     *
     * /cat-exam?schedule_id=3
     *
     * Peserta hanya boleh membuka jadwal
     * yang memang ditugaskan kepadanya.
     */

    if (!scheduleIdParam) {
      throw new Error(
        "ID jadwal ujian tidak ditemukan. Silakan kembali ke halaman Jadwal Ujian."
      );
    }

    const selectedScheduleId =
      Number(scheduleIdParam);

    if (
      !Number.isInteger(
        selectedScheduleId
      ) ||
      selectedScheduleId <= 0
    ) {
      throw new Error(
        "ID jadwal ujian tidak valid."
      );
    }

    /*
     * ============================================================
     * AMBIL JADWAL SPESIFIK
     * ============================================================
     */

    const {
      data,
      error,
    } = await supabase
      .from("participant_schedules")
      .select(`
        id,
        participant_id,
        schedule_id,
        status,
        test_schedules (
          id,
          competency_test_id,
          name,
          description,
          start_at,
          end_at,
          location,
          meeting_url,
          is_active
        )
      `)
      .eq(
        "participant_id",
        participant.id
      )
      .eq(
        "schedule_id",
        selectedScheduleId
      )
      .eq(
        "status",
        "terdaftar"
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error(
        "Jadwal ujian tidak ditemukan atau tidak diberikan kepada akun Anda."
      );
    }

    /*
     * ============================================================
     * NORMALISASI TEST SCHEDULE
     * ============================================================
     */

    const item =
      data as any;

    const testSchedule =
      Array.isArray(
        item.test_schedules
      )
        ? item.test_schedules[0]
        : item.test_schedules;

    if (!testSchedule) {
      throw new Error(
        "Data jadwal ujian tidak ditemukan."
      );
    }

    /*
     * ============================================================
     * AMBIL DATA COMPETENCY TEST
     * ============================================================
     */

    const {
      data: test,
      error: testError,
    } = await supabase
      .from("competency_tests")
      .select(`
        id,
        name,
        description,
        duration_minutes,
        passing_score,
        test_type,
        is_active
      `)
      .eq(
        "id",
        testSchedule.competency_test_id
      )
      .maybeSingle();

    if (testError) {
      throw testError;
    }

    if (!test) {
      throw new Error(
        "Data kompetensi ujian tidak ditemukan."
      );
    }

    /*
     * ============================================================
     * VALIDASI UJI CAT
     * ============================================================
     */

    if (
      test.test_type !== "cat"
    ) {
      throw new Error(
        "Jadwal yang dipilih bukan merupakan Uji CAT."
      );
    }

    if (!test.is_active) {
      throw new Error(
        "Uji CAT ini sudah tidak aktif."
      );
    }

    if (!testSchedule.is_active) {
      throw new Error(
        "Jadwal Uji CAT ini sudah tidak aktif."
      );
    }

    /*
     * ============================================================
     * RETURN DATA
     * ============================================================
     */

    return {
      examInfo: {
        id: Number(test.id),
        name: test.name,
        description:
          test.description,
        duration_minutes:
          Number(
            test.duration_minutes
          ) || 120,
        passing_score:
          Number(
            test.passing_score
          ) || 0,
      } satisfies ExamInfo,

      scheduleInfo: {
        id: Number(
          testSchedule.id
        ),
        competency_test_id:
          Number(
            testSchedule.competency_test_id
          ),
        name:
          testSchedule.name,
        description:
          testSchedule.description,
        start_at:
          testSchedule.start_at,
        end_at:
          testSchedule.end_at,
      } satisfies ScheduleInfo,
    };
  }, [
    ensureAuthenticated,
    scheduleIdParam,
  ]);

  /*
   * ============================================================
   * QUESTIONS
   * ============================================================
   */

  const loadQuestions =
    useCallback(
      async (
        scheduleId: number
      ) => {
        const {
          data,
          error,
        } = await supabase.rpc(
          "get_cat_questions",
          {
            p_schedule_id:
              scheduleId,
          }
        );

        if (error) {
          throw new Error(
            `Gagal mengambil soal: ${error.message}`
          );
        }

        const loaded =
          (data || []) as Question[];

        if (loaded.length === 0) {
          throw new Error(
            "Belum ada soal yang tersedia untuk ujian ini."
          );
        }

        setQuestions(
          loaded
            .map((question) => ({
              ...question,
              id: Number(question.id),
              competency_test_id:
                Number(
                  question.competency_test_id
                ),
              score: Number(
                question.score || 0
              ),
              question_order:
                Number(
                  question.question_order
                ),
            }))
            .sort(
              (a, b) =>
                a.question_order -
                b.question_order
            )
        );
      },
      []
    );

  /*
   * ============================================================
   * EXISTING ANSWERS
   * ============================================================
   */

  const loadExistingAnswers =
    useCallback(
      async (
        currentAttemptId: number
      ) => {
        const {
          data,
          error,
        } = await supabase
          .from("exam_answers")
          .select(`
            question_id,
            selected_answer
          `)
          .eq(
            "attempt_id",
            currentAttemptId
          );

        if (error) {
          throw error;
        }

        const map: AnswerMap = {};

        for (const item of data || []) {
          if (item.selected_answer) {
            map[
              Number(item.question_id)
            ] =
              String(
                item.selected_answer
              ).toUpperCase();
          }
        }

        setAnswers(map);
      },
      []
    );

/*
 * ============================================================
 * START / RESUME
 * ============================================================
 */

  /*
   * ============================================================
   * START / RESUME
   * ============================================================
   */

  const startExam = useCallback(
    async (
      examInfo: ExamInfo,
      scheduleInfo: ScheduleInfo,
      providedToken?: string
    ) => {
      const token =
        providedToken ??
        sessionToken ??
        crypto.randomUUID();

      const {
        data,
        error,
      } = await supabase.rpc(
        "start_exam_attempt",
        {
          p_competency_test_id:
            examInfo.id,
          p_schedule_id:
            scheduleInfo.id,
          p_total_questions:
            questions.length,
          p_session_token:
            token,
        }
      );

      if (error) {
        throw new Error(
          translateRpcError(
            error.message
          )
        );
      }

      const row =
        Array.isArray(data)
          ? data[0]
          : data;

      if (!row) {
        throw new Error(
          "Server tidak mengembalikan data sesi ujian."
        );
      }

      const result =
        row as StartExamResult;

      const currentAttemptId =
        Number(result.attempt_id);

      if (!currentAttemptId) {
        throw new Error(
          "ID sesi ujian tidak valid."
        );
      }

      /*
       * ============================================================
       * DISQUALIFIED
       * ============================================================
       */

      if (
        result.disqualified ||
        result.attempt_status ===
          "disqualified"
      ) {
        setAttemptId(
          currentAttemptId
        );

        setViolationCount(
          Number(
            result.violation_count || 0
          )
        );

        setRemainingSeconds(0);
        setDisqualified(true);
        setFinished(true);
        setStarted(false);

        setDisqualificationReason(
          result.disqualification_reason ||
            "Peserta telah didiskualifikasi."
        );

        return;
      }

      /*
       * ============================================================
       * EXPIRED
       * ============================================================
       */

      if (
        result.attempt_status ===
        "expired"
      ) {
        setAttemptId(
          currentAttemptId
        );

        setViolationCount(
          Number(
            result.violation_count || 0
          )
        );

        setRemainingSeconds(0);
        setFinished(true);
        setStarted(false);

        setError(
          "Waktu ujian telah habis."
        );

        return;
      }

      /*
       * ============================================================
       * COMPLETED / SUBMITTED
       * ============================================================
       */

      if (
        result.mode === "completed" ||
        result.attempt_status ===
          "submitted"
      ) {
        setAttemptId(
          currentAttemptId
        );

        setFinished(true);
        setStarted(false);

        setError(
          "Ujian untuk jadwal ini sudah pernah diselesaikan."
        );

        return;
      }

      /*
       * ============================================================
       * ACTIVE ATTEMPT
       * ============================================================
       */

      if (
        result.attempt_status !==
        "in_progress"
      ) {
        throw new Error(
          "Status sesi ujian tidak valid."
        );
      }

      const serverSessionToken =
        result.session_token
          ? String(
              result.session_token
            )
          : undefined;

      if (!serverSessionToken) {
        throw new Error(
          "Server tidak mengembalikan token sesi ujian."
        );
      }

      setSessionToken(
        serverSessionToken
      );

      setAttemptId(
        currentAttemptId
      );

      setViolationCount(
        Number(
          result.violation_count || 0
        )
      );

      setRemainingSeconds(
        Math.max(
          0,
          Number(
            result.remaining_seconds ||
              0
          )
        )
      );

      setStarted(true);
      setFinished(false);

      await loadExistingAnswers(
        currentAttemptId
      );
    },
    [
      loadExistingAnswers,
      questions.length,
      sessionToken,
    ]
  );

  const loadExam =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const {
          examInfo,
          scheduleInfo,
        } =
          await loadSchedule();

        setExam(examInfo);
        setSchedule(scheduleInfo);

        await loadQuestions(
          scheduleInfo.id
        );

        /*
         * Jangan membuat attempt
         * otomatis.
         *
         * Resume hanya jika ada attempt
         * aktif milik peserta.
         */

        const user =
          await ensureAuthenticated();

        const {
          data: participant,
          error:
            participantError,
        } = await supabase
          .from("participants")
          .select("id")
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle();

        if (participantError) {
          throw participantError;
        }

        if (!participant) {
          throw new Error(
            "Peserta tidak ditemukan."
          );
        }

        const {
  data: activeAttempts,
  error: activeError,
} = await supabase
  .from("exam_attempts")
  .select(`
    id,
    status,
    disqualified
  `)
  .eq(
    "participant_id",
    participant.id
  )
  .eq(
    "competency_test_id",
    examInfo.id
  )
  .eq(
    "schedule_id",
    scheduleInfo.id
  )
  .eq(
    "status",
    "in_progress"
  )
  .eq(
    "disqualified",
    false
  )
  .limit(1);

if (activeError) {
  throw activeError;
}

if (
  activeAttempts &&
  activeAttempts.length > 0
) {
  await startExam(
    examInfo,
    scheduleInfo
  );
}
      } catch (err) {
        console.error(
          "LOAD EXAM:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Uji CAT gagal dimuat."
        );
      } finally {
        setLoading(false);
      }
    }, [
      ensureAuthenticated,
      loadQuestions,
      loadSchedule,
      startExam,
    ]);

  useEffect(() => {
    if (initialLoadRef.current) {
      return;
    }

    initialLoadRef.current = true;

    void loadExam();
  }, [loadExam]);

  /*
   * ============================================================
   * TIMER
   * ============================================================
   */

  useEffect(() => {
    if (
      !started ||
      finished ||
      disqualified
    ) {
      return;
    }

    const timer =
      window.setInterval(() => {
        setRemainingSeconds(
          (seconds) =>
            Math.max(
              0,
              seconds - 1
            )
        );
      }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    started,
    finished,
    disqualified,
  ]);

  /*
   * ============================================================
   * AUTO SUBMIT
   * ============================================================
   */

  useEffect(() => {
    if (
      !started ||
      finished ||
      disqualified ||
      !attemptId ||
      !sessionToken ||
      remainingSeconds > 0
    ) {
      return;
    }

    void handleSubmit(true);
  }, [
    remainingSeconds,
    started,
    finished,
    disqualified,
    attemptId,
    sessionToken,
  ]);

  /*
   * ============================================================
   * START BUTTON
   * ============================================================
   */

  async function handleStartExam() {
    if (
      starting ||
      !exam ||
      !schedule
    ) {
      return;
    }

    try {
      setStarting(true);
      setError("");

      await startExam(
        exam,
        schedule
      );
    } catch (err) {
      console.error(
        "START EXAM:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Ujian gagal dimulai."
      );
    } finally {
      setStarting(false);
    }
  }

  /*
   * ============================================================
   * ANSWER
   * ============================================================
   */

  async function handleAnswer(
    answer: string
  ) {
    if (
      !currentQuestion ||
      !attemptId ||
      !sessionToken ||
      finished ||
      disqualified ||
      submitting
    ) {
      return;
    }

    const normalized =
      answer.toUpperCase();

    setAnswers((previous) => ({
      ...previous,
      [currentQuestion.id]:
        normalized,
    }));

    try {
      const {
        data,
        error,
      } = await supabase.rpc(
        "save_exam_answer",
        {
          p_attempt_id:
            attemptId,
          p_question_id:
            currentQuestion.id,
          p_selected_answer:
            normalized,
          p_session_token:
            sessionToken,
        }
      );

      if (error) {
        throw new Error(
          translateRpcError(
            error.message
          )
        );
      }

      const row =
        Array.isArray(data)
          ? data[0]
          : data;

      if (!row) {
        throw new Error(
          "Server tidak mengembalikan status jawaban."
        );
      }

      const result =
        row as SaveAnswerResult;

      setRemainingSeconds(
        Number(
          result.remaining_seconds || 0
        )
      );
    } catch (err) {
      console.error(
        "SAVE ANSWER:",
        err
      );

      await loadExistingAnswers(
        attemptId
      );

      setError(
        err instanceof Error
          ? err.message
          : "Jawaban gagal disimpan."
      );
    }
  }

  /*
   * ============================================================
   * SUBMIT
   * ============================================================
   */

  async function handleSubmit(
    autoSubmit = false
  ) {
    if (
      submitProcessingRef.current ||
      submitting ||
      finished ||
      disqualified ||
      !attemptId ||
      !sessionToken
    ) {
      return;
    }

    if (!autoSubmit) {
      const confirmed =
        window.confirm(
          `Anda telah menjawab ${answeredCount} dari ${questions.length} soal.\n\nApakah Anda yakin ingin menyelesaikan ujian?`
        );

      if (!confirmed) {
        return;
      }
    }

    try {
      submitProcessingRef.current =
        true;

      setSubmitting(true);
      setError("");

      const {
        data,
        error,
      } = await supabase.rpc(
        "submit_exam_attempt",
        {
          p_attempt_id:
            attemptId,
          p_session_token:
            sessionToken,
          p_auto_submit:
            autoSubmit,
        }
      );

      if (error) {
        throw new Error(
          translateRpcError(
            error.message
          )
        );
      }

      const row =
        Array.isArray(data)
          ? data[0]
          : data;

      if (!row) {
        throw new Error(
          "Server tidak mengembalikan hasil ujian."
        );
      }

      const result =
        row as SubmitResult;

      setFinished(true);

      setRemainingSeconds(
        Number(
          result.remaining_seconds || 0
        )
      );

      window.alert(
        `Ujian ${
          result.status ===
          "expired"
            ? "berakhir karena waktu habis"
            : "selesai"
        }.

Benar: ${
          result.correct_answers
        } dari ${
          result.total_questions
        }

Terjawab: ${
          result.answered_questions
        }

Nilai: ${Number(
          result.score
        ).toFixed(2)}

Passing Grade: ${
          Number(
            result.passing_score
          ).toFixed(2)
        }

Status: ${
          result.passed
            ? "LULUS"
            : "TIDAK LULUS"
        }`
      );

      window.location.href =
        "/results";
    } catch (err) {
      console.error(
        "SUBMIT:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Gagal menyelesaikan ujian."
      );
    } finally {
      submitProcessingRef.current =
        false;

      setSubmitting(false);
    }
  }

/*
 * ============================================================
 * VIOLATION
 * ============================================================
 */

const registerViolation =
  useCallback(
    async (reason: string) => {
      /*
       * Jangan proses jika:
       * - attempt belum tersedia
       * - ujian sudah selesai
       * - sudah didiskualifikasi
       * - sedang memproses pelanggaran lain
       */
      if (
        !attemptId ||
        finished ||
        disqualified ||
        violationProcessingRef.current
      ) {
        return;
      }

      /*
       * ========================================================
       * COOLDOWN
       * ========================================================
       *
       * Browser bisa memicu:
       *
       * visibilitychange
       * blur
       *
       * hampir bersamaan.
       *
       * Kita hanya menerima satu pelanggaran dalam 3 detik.
       */

      const now = Date.now();

      if (
        now -
          lastViolationTimeRef.current <
        3000
      ) {
        return;
      }

      lastViolationTimeRef.current =
        now;

      violationProcessingRef.current =
        true;

      try {
        console.log(
          "[CAT] Mengirim pelanggaran:",
          reason
        );

const { data: authData, error: authError } =
  await supabase.auth.getUser();

console.log("[CAT] AUTH USER:", authData.user);
console.log("[CAT] AUTH ERROR:", authError);

const { data, error } = await supabase.rpc(
  "register_cat_violation",
  {
    p_attempt_id: attemptId,
    p_reason: reason,
  }
);

        /*
         * ======================================================
         * RPC ERROR
         * ======================================================
         */

        if (error) {
          console.error(
            "[CAT] RPC violation error:",
            error
          );

          throw new Error(
            error.message ||
              "Gagal mencatat pelanggaran."
          );
        }

        /*
         * ======================================================
         * NORMALISASI RESPONSE
         * ======================================================
         */

        let result:
          | ViolationResult
          | null = null;

        if (
          Array.isArray(data)
        ) {
          result =
            data[0] as
              | ViolationResult
              | null;
        } else if (data) {
          result =
            data as ViolationResult;
        }

        if (!result) {
          console.error(
            "[CAT] Response violation kosong:",
            data
          );

          throw new Error(
            "Server tidak mengembalikan status pelanggaran."
          );
        }

        console.log(
          "[CAT] Response violation:",
          result
        );

        /*
         * ======================================================
         * UPDATE VIOLATION COUNT
         * ======================================================
         */

        const newViolationCount =
          Number(
            result.violation_count || 0
          );

        setViolationCount(
          newViolationCount
        );

        /*
         * ======================================================
         * DISQUALIFIED
         * ======================================================
         *
         * PENTING:
         *
         * Jika server mengatakan disqualified,
         * jangan menunggu state lain.
         *
         * Langsung hentikan ujian.
         */

        if (
          result.disqualified === true ||
          result.attempt_status ===
            "disqualified"
        ) {
          console.log(
            "[CAT] PESERTA DIDISKUALIFIKASI"
          );

          setDisqualified(true);

          setFinished(true);

          setStarted(false);

          setShowWarning(false);

          setDisqualificationReason(
            result.reason ||
              `Peserta didiskualifikasi karena pelanggaran ke-${newViolationCount}.`
          );

          /*
           * Pastikan timer tidak dapat
           * terus berjalan.
           */

          setRemainingSeconds(0);

          return;
        }

        /*
         * ======================================================
         * PELANGGARAN PERTAMA
         * ======================================================
         */

        if (
          newViolationCount === 1
        ) {
          setWarningMessage(
            `PERINGATAN PELANGGARAN 1/2

${reason}

Pelanggaran berikutnya akan menyebabkan Anda langsung didiskualifikasi dari ujian.`
          );

          setShowWarning(true);

          return;
        }

        /*
         * ======================================================
         * FALLBACK
         * ======================================================
         */

        setWarningMessage(
          `PERINGATAN PELANGGARAN ${newViolationCount}/2

${result.reason || reason}`
        );

        setShowWarning(true);
      } catch (err) {
        console.error(
          "[CAT] VIOLATION ERROR:",
          err
        );

        /*
         * Jangan diam-diam menghilangkan
         * error seperti sebelumnya.
         */

        const message =
          err instanceof Error
            ? err.message
            : "Gagal mencatat pelanggaran.";

        setError(
          `Pelanggaran gagal dicatat ke server.\n\n${message}`
        );
      } finally {
        violationProcessingRef.current =
          false;
      }
    },
    [
      attemptId,
      finished,
      disqualified,
    ]
  );

/*
 * ============================================================
 * ANTI CHEATING
 * ============================================================
 */

useEffect(() => {
  if (
    !started ||
    finished ||
    disqualified ||
    !attemptId
  ) {
    return;
  }

  /*
   * ==========================================================
   * CEGAH DOUBLE EVENT
   * ==========================================================
   *
   * Satu aksi pindah tab dapat menghasilkan:
   *
   * visibilitychange
   * blur
   *
   * secara bersamaan.
   *
   * Event hanya boleh menghasilkan SATU pelanggaran.
   */

  let lastDetectedReason =
    "";

  let lastDetectedTime = 0;

  const detectViolation = (
    reason: string
  ) => {
    const now = Date.now();

    /*
     * Jangan proses reason yang sama
     * dalam waktu sangat dekat.
     */

    if (
      lastDetectedReason ===
        reason &&
      now -
        lastDetectedTime <
        3000
    ) {
      return;
    }

    /*
     * visibilitychange + blur
     * bisa mempunyai alasan berbeda
     * tetapi terjadi pada waktu hampir sama.
     *
     * Karena itu tetap blokir event
     * yang muncul dalam 500ms.
     */

    if (
      now -
        lastDetectedTime <
      500
    ) {
      return;
    }

    lastDetectedReason =
      reason;

    lastDetectedTime = now;

    void registerViolation(
      reason
    );
  };

  /*
   * ==========================================================
   * VISIBILITY CHANGE
   * ==========================================================
   */

  const onVisibilityChange =
    () => {
      if (
        document.visibilityState ===
        "hidden"
      ) {
        detectViolation(
          "Peserta meninggalkan halaman ujian atau berpindah tab."
        );
      }
    };

  /*
   * ==========================================================
   * WINDOW BLUR
   * ==========================================================
   */

  const onBlur = () => {
    detectViolation(
      "Peserta meninggalkan jendela ujian atau membuka jendela/tab lain."
    );
  };

  /*
   * ==========================================================
   * BROWSER BACK/FORWARD
   * ==========================================================
   */

  const onPopState = () => {
    detectViolation(
      "Peserta menggunakan tombol navigasi Back/Forward browser saat ujian berlangsung."
    );
  };

  /*
   * ==========================================================
   * REGISTER EVENT
   * ==========================================================
   */

  document.addEventListener(
    "visibilitychange",
    onVisibilityChange
  );

  window.addEventListener(
    "blur",
    onBlur
  );

  window.addEventListener(
    "popstate",
    onPopState
  );

  /*
   * ==========================================================
   * CLEANUP
   * ==========================================================
   */

  return () => {
    document.removeEventListener(
      "visibilitychange",
      onVisibilityChange
    );

    window.removeEventListener(
      "blur",
      onBlur
    );

    window.removeEventListener(
      "popstate",
      onPopState
    );
  };
}, [
  started,
  finished,
  disqualified,
  attemptId,
  registerViolation,
]);

  function goNext() {
    if (
      currentIndex <
      questions.length - 1
    ) {
      setCurrentIndex(
        (index) =>
          index + 1
      );
    }
  }

  function goPrevious() {
    if (currentIndex > 0) {
      setCurrentIndex(
        (index) =>
          index - 1
      );
    }
  }

  /*
   * ============================================================
   * TIMER FORMAT
   * ============================================================
   */

  function formatTime(
    totalSeconds: number
  ) {
    const safe =
      Math.max(
        0,
        totalSeconds
      );

    const hours =
      Math.floor(
        safe / 3600
      );

    const minutes =
      Math.floor(
        (safe % 3600) / 60
      );

    const seconds =
      safe % 60;

    return [
      hours
        .toString()
        .padStart(2, "0"),
      minutes
        .toString()
        .padStart(2, "0"),
      seconds
        .toString()
        .padStart(2, "0"),
    ].join(":");
  }

  /*
   * ============================================================
   * LOADING
   * ============================================================
   */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="rounded-xl bg-white px-8 py-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />

            <p className="text-sm text-gray-500">
              Memuat Uji CAT...
            </p>
          </div>
        </div>
      </main>
    );
  }

  /*
   * ============================================================
   * ERROR
   * ============================================================
   */

  if (error) {
    return (
      <main className="min-h-screen bg-gray-100">
        <header className="border-b bg-white">
          <div className="flex min-h-16 items-center justify-between px-6 py-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                LSP-PDN Kemendagri
              </h1>

              <p className="text-xs text-gray-500">
                Sistem Uji Kompetensi Aparatur Pemerintahan Dalam Negeri
              </p>
            </div>

            <Link
              href="/schedules"
              className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Kembali
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-3xl p-6">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <div className="text-5xl">
              ⚠️
            </div>

            <h2 className="mt-4 text-xl font-bold text-red-800">
              Uji CAT Tidak Dapat Dilanjutkan
            </h2>

            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-red-700">
              {error}
            </p>

            <Link
              href="/schedules"
              className="mt-6 inline-flex rounded-lg bg-white px-5 py-3 text-sm font-semibold text-gray-700 shadow-sm ring-1 ring-red-200 hover:bg-gray-50"
            >
              Kembali ke Jadwal
            </Link>
          </div>
        </div>
      </main>
    );
  }

  /*
   * ============================================================
   * DATA
   * ============================================================
   */

  if (
    !exam ||
    !schedule ||
    questions.length === 0
  ) {
    return null;
  }

  /*
   * ============================================================
   * WARNING
   * ============================================================
   */

  if (
    showWarning &&
    !disqualified
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-yellow-300 bg-white p-8 text-center shadow-lg">
          <div className="text-5xl">
            ⚠️
          </div>

          <h2 className="mt-4 text-2xl font-bold text-yellow-800">
            Peringatan Pelanggaran
          </h2>

          <div className="mt-5 whitespace-pre-line rounded-xl bg-yellow-50 p-5 text-left text-sm leading-relaxed text-yellow-900">
            {warningMessage}
          </div>

          <button
            type="button"
            onClick={() =>
              setShowWarning(false)
            }
            className="mt-6 rounded-lg bg-yellow-600 px-8 py-3 text-sm font-semibold text-white hover:bg-yellow-700"
          >
            Saya Mengerti
          </button>
        </div>
      </main>
    );
  }

  /*
   * ============================================================
   * DISQUALIFIED
   * ============================================================
   */

  if (disqualified) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-red-300 bg-white p-8 text-center shadow-lg">
          <div className="text-5xl">
            🚫
          </div>

          <h2 className="mt-4 text-2xl font-bold text-red-800">
            Ujian Didiskualifikasi
          </h2>

          <p className="mt-4 whitespace-pre-line rounded-xl bg-red-50 p-5 text-sm leading-relaxed text-red-700">
            {disqualificationReason}
          </p>

          <Link
            href="/results"
            className="mt-6 inline-flex rounded-lg bg-red-600 px-7 py-3 text-sm font-semibold text-white hover:bg-red-700"
          >
            Lihat Hasil
          </Link>
        </div>
      </main>
    );
  }

  /*
   * ============================================================
   * INSTRUKSI
   * ============================================================
   */

  if (!started) {
    return (
      <main className="min-h-screen bg-gray-100">
        <header className="border-b bg-white">
          <div className="flex min-h-16 items-center justify-between px-6 py-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                LSP-PDN Kemendagri
              </h1>

              <p className="text-xs text-gray-500">
                Sistem Uji Kompetensi Aparatur Pemerintahan Dalam Negeri
              </p>
            </div>

            <Link
              href="/schedules"
              className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Kembali
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-4xl p-6">
          <div className="rounded-2xl border bg-white p-8 shadow-sm">
            <div className="text-center">
              <span className="inline-flex rounded-full bg-blue-100 px-4 py-1.5 text-xs font-bold text-blue-700">
                UJI CAT
              </span>

              <h2 className="mt-4 text-2xl font-bold text-gray-900">
                {exam.name}
              </h2>

              {exam.description && (
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-gray-500">
                  {exam.description}
                </p>
              )}
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <InfoCard
                label="Jumlah Soal"
                value={questions.length.toString()}
              />

              <InfoCard
                label="Durasi"
                value={`${exam.duration_minutes} menit`}
              />

              <InfoCard
                label="Passing Grade"
                value={String(
                  exam.passing_score
                )}
              />
            </div>

            <div className="mt-8 rounded-2xl border border-yellow-200 bg-yellow-50 p-6">
              <h3 className="font-bold text-yellow-900">
                Petunjuk Ujian
              </h3>

              <ul className="mt-4 space-y-3 text-sm leading-relaxed text-yellow-800">
                <li>
                  ✓ Ujian terdiri dari{" "}
                  <strong>
                    {questions.length}
                  </strong>{" "}
                  soal.
                </li>

                <li>
                  ✓ Waktu pengerjaan{" "}
                  <strong>
                    {exam.duration_minutes} menit
                  </strong>
                  .
                </li>

                <li>
                  ✓ Pilih satu jawaban yang paling tepat.
                </li>

                <li>
                  ✓ Jawaban disimpan otomatis ke server.
                </li>

                <li>
                  ✓ Timer dihitung berdasarkan waktu server.
                </li>

                <li>
                  ✓ Jika koneksi terputus, attempt dapat dilanjutkan selama waktu masih tersedia.
                </li>

                <li>
                  ⚠ Jangan berpindah tab atau jendela.
                </li>

                <li>
                  ⚠ Jangan menggunakan Back/Forward browser.
                </li>

                <li>
                  ⚠ Pelanggaran pertama menghasilkan peringatan.
                </li>

                <li>
                  🚫 Pelanggaran kedua menyebabkan diskualifikasi.
                </li>
              </ul>
            </div>

            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={
                  handleStartExam
                }
                disabled={starting}
                className="rounded-xl bg-blue-600 px-12 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {starting
                  ? "Memulai Ujian..."
                  : "Mulai Ujian"}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /*
   * ============================================================
   * EXAM PAGE
   * ============================================================
   */

  return (
    <main className="min-h-screen bg-gray-100">
      <header className="sticky top-0 z-30 border-b bg-white shadow-sm">
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="min-w-0">
            <h1 className="truncate font-bold text-gray-900">
              Uji CAT — LSP-PDN Kemendagri
            </h1>

            <p className="truncate text-xs text-gray-500">
              {exam.name}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 sm:block">
              Pelanggaran:{" "}
              <span className="font-bold">
                {violationCount}/2
              </span>
            </div>

            <div
              className={`rounded-xl px-4 py-2.5 text-sm font-bold ${
                remainingSeconds <= 300
                  ? "bg-red-100 text-red-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              ⏱{" "}
              {formatTime(
                remainingSeconds
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 p-4 lg:grid-cols-[1fr_300px] lg:p-6">
        <section>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  Soal {currentIndex + 1} dari{" "}
                  {questions.length}
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Progress {progress}%
                </p>
              </div>

              {currentQuestion.difficulty && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium capitalize text-gray-600">
                  {currentQuestion.difficulty}
                </span>
              )}
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-300"
                style={{
                  width: `${progress}%`,
                }}
              />
            </div>
          </div>

          <div className="mt-5 rounded-2xl border bg-white p-5 shadow-sm lg:p-7">
            <div className="mb-7">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                Pertanyaan
              </p>

              <h2 className="mt-3 text-lg font-semibold leading-relaxed text-gray-900 lg:text-xl">
                {currentQuestion.question_text}
              </h2>

              {currentQuestion.competency_unit && (
                <p className="mt-4 text-xs text-gray-500">
                  Unit Kompetensi:{" "}
                  <span className="font-semibold text-gray-700">
                    {currentQuestion.competency_unit}
                  </span>
                </p>
              )}
            </div>

            <div className="space-y-3">
              {[
                ["A", currentQuestion.option_a],
                ["B", currentQuestion.option_b],
                ["C", currentQuestion.option_c],
                ["D", currentQuestion.option_d],
              ].map(([label, text]) => (
                <AnswerOption
                  key={label}
                  label={label}
                  text={text}
                  selected={
                    answers[
                      currentQuestion.id
                    ] === label
                  }
                  onClick={() =>
                    void handleAnswer(
                      label
                    )
                  }
                />
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between gap-3 border-t pt-5">
              <button
                type="button"
                onClick={goPrevious}
                disabled={
                  currentIndex === 0
                }
                className="rounded-lg border px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Sebelumnya
              </button>

              {currentIndex <
              questions.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Berikutnya →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    void handleSubmit(false)
                  }
                  disabled={submitting}
                  className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? "Menyimpan..."
                    : "Selesai Ujian"}
                </button>
              )}
            </div>
          </div>
        </section>

        <aside className="h-fit rounded-2xl border bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">
              Navigasi Soal
            </h3>

            <span className="text-xs text-gray-500">
              {answeredCount}/
              {questions.length}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-5 gap-2">
            {questions.map(
              (question, index) => {
                const answered =
                  Boolean(
                    answers[
                      question.id
                    ]
                  );

                const active =
                  index === currentIndex;

                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() =>
                      setCurrentIndex(
                        index
                      )
                    }
                    className={`h-10 rounded-lg border text-sm font-bold transition ${
                      active
                        ? "border-blue-600 bg-blue-600 text-white"
                        : answered
                        ? "border-green-300 bg-green-100 text-green-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {index + 1}
                  </button>
                );
              }
            )}
          </div>

          <div className="mt-5 space-y-2 border-t pt-4 text-xs text-gray-500">
            <Legend
              className="bg-blue-600"
              label="Soal aktif"
            />

            <Legend
              className="bg-green-100 ring-1 ring-green-300"
              label="Sudah dijawab"
            />

            <Legend
              className="border bg-white"
              label="Belum dijawab"
            />
          </div>

          <div className="mt-5 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
            <div className="flex justify-between">
              <span>
                Pelanggaran
              </span>

              <span className="font-bold">
                {violationCount}/2
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              void handleSubmit(false)
            }
            disabled={submitting}
            className="mt-5 w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Menyimpan..."
              : "Selesaikan Ujian"}
          </button>
        </aside>
      </div>
    </main>
  );
}

/*
 * ============================================================
 * ANSWER OPTION
 * ============================================================
 */

function AnswerOption({
  label,
  text,
  selected,
  onClick,
}: {
  label: string;
  text: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-4 rounded-xl border p-4 text-left transition ${
        selected
          ? "border-blue-600 bg-blue-50 ring-1 ring-blue-600"
          : "border-gray-200 bg-white hover:border-blue-300 hover:bg-gray-50"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          selected
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-700"
        }`}
      >
        {label}
      </span>

      <span className="pt-1 text-sm leading-relaxed text-gray-800">
        {text}
      </span>
    </button>
  );
}

/*
 * ============================================================
 * INFO CARD
 * ============================================================
 */

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-5 text-center">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-gray-900">
        {value}
      </p>
    </div>
  );
}

/*
 * ============================================================
 * LEGEND
 * ============================================================
 */

function Legend({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-3 w-3 rounded ${className}`}
      />
      {label}
    </div>
  );
}

/*
 * ============================================================
 * RPC ERROR
 * ============================================================
 */

function translateRpcError(
  message: string
) {
  const normalized =
    message.toUpperCase();

  if (
    normalized.includes(
      "AUTH_REQUIRED"
    ) ||
    normalized.includes(
      "SESI LOGIN"
    )
  ) {
    return "Sesi login telah berakhir. Silakan login kembali.";
  }

  if (
    normalized.includes(
      "PARTICIPANT_NOT_FOUND"
    )
  ) {
    return "Data peserta tidak ditemukan.";
  }

  if (
    normalized.includes(
      "SCHEDULE_NOT_AVAILABLE"
    )
  ) {
    return "Jadwal Uji CAT tidak tersedia atau sudah tidak aktif.";
  }

  if (
    normalized.includes(
      "COMPETENCY_TEST_NOT_FOUND"
    )
  ) {
    return "Data kompetensi ujian tidak ditemukan.";
  }

  if (
    normalized.includes(
      "ATTEMPT_ALREADY_COMPLETED"
    ) ||
    normalized.includes(
      "SUDAH PERNAH DISELESAIKAN"
    )
  ) {
    return "Ujian untuk jadwal ini sudah pernah diselesaikan.";
  }

  if (
    normalized.includes(
      "UJIAN_SEDANG_DIBUKA"
    )
  ) {
    return "Ujian sedang dibuka pada jendela atau tab browser lain.";
  }

  if (
    normalized.includes(
      "ATTEMPT_NOT_FOUND"
    )
  ) {
    return "Sesi ujian tidak ditemukan.";
  }

  if (
    normalized.includes(
      "ATTEMPT_NOT_ACTIVE"
    )
  ) {
    return "Sesi ujian sudah tidak aktif.";
  }

  if (
    normalized.includes(
      "ATTEMPT_DISQUALIFIED"
    )
  ) {
    return "Peserta telah didiskualifikasi dari ujian.";
  }

  if (
    normalized.includes(
      "INVALID_SESSION"
    ) ||
    normalized.includes(
      "SESI UJIAN TIDAK VALID"
    )
  ) {
    return "Sesi ujian tidak valid. Silakan gunakan jendela ujian yang pertama.";
  }

  if (
    normalized.includes(
      "EXAM_TIME_EXPIRED"
    )
  ) {
    return "Waktu ujian telah habis.";
  }

  if (
    normalized.includes(
      "QUESTION_NOT_FOUND"
    )
  ) {
    return "Soal tidak ditemukan atau sudah tidak aktif.";
  }

  if (
    normalized.includes(
      "INVALID_ANSWER"
    )
  ) {
    return "Pilihan jawaban tidak valid.";
  }
if (message.includes("SCHEDULE_NOT_STARTED")) {
    return "Ujian belum dimulai. Silakan kembali sesuai jadwal ujian.";
  }

  if (message.includes("SCHEDULE_EXPIRED")) {
    return "Jadwal ujian sudah berakhir.";
  }

  if (message.includes("ATTEMPT_COMPLETED")) {
    return "Ujian untuk jadwal ini sudah pernah diselesaikan.";
  }

  if (message.includes("ATTEMPT_EXPIRED")) {
    return "Waktu ujian telah habis.";
  }

  if (message.includes("SESSION_TOKEN_INVALID")) {
    return "Sesi ujian tidak valid. Silakan muat ulang halaman.";
  }
  return message;
}