import { db, uuidv4, now } from "../database";
import {
  CheckRequest,
  Escort,
  DepartmentDistance,
  AssignmentSuggestion,
  EscortWorkload,
  OvertimeWaitResult,
  UrgencyLevel,
} from "../types";

const DISTANCE_WEIGHT = 0.3;
const LOAD_WEIGHT = 0.25;
const SKILL_WEIGHT = 0.25;
const PRIORITY_WEIGHT = 0.2;

const OVERTIME_THRESHOLDS: Record<UrgencyLevel, number> = {
  normal: 30,
  urgent: 15,
  emergency: 5,
};

export function calculateDistanceScore(
  sourceDepartment: string,
  targetDepartment: string,
  escortLocation: string
): number {
  if (!sourceDepartment || !escortLocation) {
    return 50;
  }

  const distance = db
    .prepare(
      "SELECT * FROM department_distances WHERE source_department = ? AND target_department = ?"
    )
    .get(escortLocation, sourceDepartment) as DepartmentDistance | undefined;

  if (!distance) {
    const reverseDistance = db
      .prepare(
        "SELECT * FROM department_distances WHERE source_department = ? AND target_department = ?"
      )
      .get(sourceDepartment, escortLocation) as DepartmentDistance | undefined;

    if (!reverseDistance) {
      return 60;
    }

    const minutes = reverseDistance.estimated_minutes || 10;
    return calculateScoreByTime(minutes);
  }

  const minutes = distance.estimated_minutes || 10;
  return calculateScoreByTime(minutes);
}

function calculateScoreByTime(minutes: number): number {
  if (minutes <= 2) return 100;
  if (minutes <= 5) return 90;
  if (minutes <= 10) return 75;
  if (minutes <= 15) return 60;
  if (minutes <= 20) return 45;
  if (minutes <= 30) return 30;
  return Math.max(10, 100 - minutes * 2.5);
}

export function calculateLoadScore(escortId: string): number {
  const workload = getEscortWorkload(escortId);
  if (!workload) return 50;

  const currentLoad = workload.current_task_count;
  const todayCompleted = workload.today_completed;

  let loadScore = 100;

  if (currentLoad >= 3) {
    loadScore = 20;
  } else if (currentLoad === 2) {
    loadScore = 50;
  } else if (currentLoad === 1) {
    loadScore = 80;
  }

  if (todayCompleted >= 10) {
    loadScore = Math.max(20, loadScore - 20);
  } else if (todayCompleted >= 5) {
    loadScore = Math.max(30, loadScore - 10);
  }

  if (!workload.is_available) {
    loadScore = 0;
  }

  return loadScore;
}

export function calculateSkillScore(
  isPatientIsolated: boolean,
  isEscortSpecialist: number
): number {
  if (isPatientIsolated) {
    return isEscortSpecialist === 1 ? 100 : 0;
  }

  if (isEscortSpecialist === 1) {
    return 80;
  }

  return 60;
}

export function calculatePriorityScore(urgency: UrgencyLevel | string): number {
  switch (urgency) {
    case "emergency":
      return 100;
    case "urgent":
      return 75;
    case "normal":
    default:
      return 50;
  }
}

export function calculateEstimatedArrival(
  escortId: string,
  targetDepartment: string
): number {
  const escort = db
    .prepare("SELECT * FROM escorts WHERE id = ?")
    .get(escortId) as Escort | undefined;

  if (!escort || !escort.current_location) {
    return 10;
  }

  const distance = db
    .prepare(
      "SELECT * FROM department_distances WHERE source_department = ? AND target_department = ?"
    )
    .get(escort.current_location, targetDepartment) as DepartmentDistance | undefined;

  if (distance) {
    return distance.estimated_minutes || 10;
  }

  const reverseDistance = db
    .prepare(
      "SELECT * FROM department_distances WHERE source_department = ? AND target_department = ?"
    )
    .get(targetDepartment, escort.current_location) as DepartmentDistance | undefined;

  if (reverseDistance) {
    return reverseDistance.estimated_minutes || 10;
  }

  return 10;
}

export function getEscortWorkload(escortId: string): EscortWorkload | null {
  const escort = db
    .prepare("SELECT * FROM escorts WHERE id = ?")
    .get(escortId) as Escort | undefined;

  if (!escort) return null;

  const activeTasks = db
    .prepare(
      "SELECT COUNT(*) as count FROM check_requests WHERE escort_id = ? AND status IN ('assigned', 'accepted', 'in_progress')"
    )
    .get(escortId) as { count: number };

  const pendingCount = db
    .prepare(
      "SELECT COUNT(*) as count FROM check_requests WHERE escort_id = ? AND status = 'assigned'"
    )
    .get(escortId) as { count: number };

  const inProgressCount = db
    .prepare(
      "SELECT COUNT(*) as count FROM check_requests WHERE escort_id = ? AND status IN ('accepted', 'in_progress')"
    )
    .get(escortId) as { count: number };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStr = todayStart.toISOString().slice(0, 10);

  const todayCompleted = db
    .prepare(
      "SELECT COUNT(*) as count FROM check_requests WHERE escort_id = ? AND DATE(completed_at) = ?"
    )
    .get(escortId, todayStr) as { count: number };

  const completedTasks = db
    .prepare(
      "SELECT started_at, completed_at FROM check_requests WHERE escort_id = ? AND status IN ('completed', 'settled') AND started_at IS NOT NULL AND completed_at IS NOT NULL LIMIT 10"
    )
    .all(escortId) as Array<{ started_at: string; completed_at: string }>;

  let avgDuration = 30;
  if (completedTasks.length > 0) {
    const durations = completedTasks.map((t) => {
      const start = new Date(t.started_at).getTime();
      const end = new Date(t.completed_at).getTime();
      return Math.round((end - start) / 60000);
    });
    avgDuration = Math.round(
      durations.reduce((a, b) => a + b, 0) / durations.length
    );
  }

  return {
    escort_id: escortId,
    escort_name: escort.name,
    current_task_count: activeTasks.count,
    pending_count: pendingCount.count,
    in_progress_count: inProgressCount.count,
    today_completed: todayCompleted.count,
    avg_task_duration: avgDuration,
    is_available: escort.status === "online",
  };
}

export function detectOvertimeWait(requestId: string): OvertimeWaitResult | null {
  const request = db
    .prepare(
      "SELECT wait_started_at, accepted_at, completed_at, urgency FROM check_requests WHERE id = ?"
    )
    .get(requestId) as
    | {
        wait_started_at?: string;
        accepted_at?: string;
        completed_at?: string;
        urgency?: UrgencyLevel;
      }
    | undefined;

  if (!request || !request.wait_started_at) return null;

  const urgency = request.urgency || "normal";
  const threshold = OVERTIME_THRESHOLDS[urgency];

  const start = new Date(request.wait_started_at).getTime();
  const endTime = request.accepted_at || request.completed_at;
  const end = endTime ? new Date(endTime).getTime() : Date.now();

  const waitDuration = Math.round((end - start) / 60000);
  const isOvertime = waitDuration > threshold;
  const overtimeMinutes = isOvertime ? waitDuration - threshold : 0;

  return {
    is_overtime: isOvertime,
    wait_duration: waitDuration,
    overtime_threshold: threshold,
    overtime_minutes: overtimeMinutes,
    urgency: urgency,
  };
}

export function generateAssignmentSuggestions(
  requestId: string
): AssignmentSuggestion[] {
  const request = db
    .prepare(
      "SELECT cr.*, p.is_isolated FROM check_requests cr LEFT JOIN patients p ON cr.patient_id = p.id WHERE cr.id = ?"
    )
    .get(requestId) as (CheckRequest & { is_isolated?: number }) | undefined;

  if (!request) {
    return [];
  }

  const availableEscorts = db
    .prepare(
      "SELECT * FROM escorts WHERE status = 'online' ORDER BY name"
    )
    .all() as Escort[];

  const suggestions: AssignmentSuggestion[] = [];
  const sourceDept = request.source_department || "";
  const targetDept = request.target_department || "";
  const urgency = (request.urgency || "normal") as UrgencyLevel;
  const isIsolated = request.is_isolated === 1;

  let maxScore = 0;

  for (const escort of availableEscorts) {
    const distanceScore = calculateDistanceScore(
      sourceDept,
      targetDept,
      escort.current_location || ""
    );

    const loadScore = calculateLoadScore(escort.id);

    const skillScore = calculateSkillScore(
      isIsolated,
      escort.is_specialist || 0
    );

    const priorityScore = calculatePriorityScore(urgency);

    const totalScore =
      distanceScore * DISTANCE_WEIGHT +
      loadScore * LOAD_WEIGHT +
      skillScore * SKILL_WEIGHT +
      priorityScore * PRIORITY_WEIGHT;

    const estimatedArrival = calculateEstimatedArrival(escort.id, sourceDept);

    const reasons: string[] = [];
    if (distanceScore >= 80) reasons.push("距离近");
    if (loadScore >= 80) reasons.push("负载低");
    if (skillScore >= 80) reasons.push("技能匹配");
    if (isIsolated && escort.is_specialist === 1) reasons.push("专人陪检");

    if (skillScore === 0) {
      continue;
    }

    if (totalScore > maxScore) {
      maxScore = totalScore;
    }

    suggestions.push({
      id: uuidv4(),
      request_id: requestId,
      escort_id: escort.id,
      score: Math.round(totalScore * 100) / 100,
      distance_score: Math.round(distanceScore * 100) / 100,
      load_score: Math.round(loadScore * 100) / 100,
      skill_score: Math.round(skillScore * 100) / 100,
      priority_score: Math.round(priorityScore * 100) / 100,
      estimated_arrival_minutes: estimatedArrival,
      reason: reasons.join("、") || "综合评分",
      is_recommended: 0,
      created_at: now(),
    });
  }

  suggestions.sort((a, b) => b.score - a.score);

  if (suggestions.length > 0) {
    suggestions[0].is_recommended = 1;
  }

  const tx = db.transaction(() => {
    db.prepare("DELETE FROM assignment_suggestions WHERE request_id = ?").run(
      requestId
    );

    const insertStmt = db.prepare(
      `INSERT INTO assignment_suggestions 
       (id, request_id, escort_id, score, distance_score, load_score, skill_score, priority_score, estimated_arrival_minutes, reason, is_recommended, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const suggestion of suggestions) {
      insertStmt.run(
        suggestion.id,
        suggestion.request_id,
        suggestion.escort_id,
        suggestion.score,
        suggestion.distance_score,
        suggestion.load_score,
        suggestion.skill_score,
        suggestion.priority_score,
        suggestion.estimated_arrival_minutes,
        suggestion.reason,
        suggestion.is_recommended,
        suggestion.created_at
      );
    }
  });

  tx();

  return suggestions;
}
