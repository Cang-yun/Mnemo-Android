import { Check, ChevronLeft, ChevronRight, LocateFixed } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  enumerateCalendarMonth,
  formatChineseDate,
  formatMonthTitle,
  parseIsoDate,
  todayIso,
  toIsoDate,
} from "../domain/date";
import { getPlanTheme } from "../domain/themes";
import type { KnowledgeItem, Plan, ScheduleEntry } from "../domain/types";

interface MonthPageProps {
  plans: Plan[];
  knowledgeItems: KnowledgeItem[];
  scheduleEntries: ScheduleEntry[];
  onOpenPlan(planId: string, date?: string): void;
  onToggleEntry(entryId: string): void;
}

const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];

export function MonthPage({
  plans,
  knowledgeItems,
  scheduleEntries,
  onOpenPlan,
  onToggleEntry,
}: MonthPageProps) {
  const [anchorDate, setAnchorDate] = useState(todayIso());
  const [filter, setFilter] = useState<"all" | "learning" | "task">("all");
  const todayRef = useRef<HTMLElement | null>(null);
  const dates = useMemo(() => enumerateCalendarMonth(anchorDate), [anchorDate]);
  const currentMonth = parseIsoDate(anchorDate).getMonth();
  const today = todayIso();
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const itemById = new Map(knowledgeItems.map((item) => [item.id, item]));
  const entriesByDate = dates.map((date) => ({
    date,
    entries: getDateEntries(date, scheduleEntries, filter, planById),
  }));
  const mobileDateGroups = entriesByDate.filter(
    (group) => group.entries.length > 0 || group.date === today,
  );

  function moveMonth(offset: number) {
    const date = parseIsoDate(anchorDate);
    // Normalize to the 1st first to avoid month-end overflow (e.g. Mar 31 + 1
    // month would otherwise become May 1 instead of April). We intentionally
    // do not try to preserve the day-of-month; the calendar shows a full grid
    // for the anchor month so the day number doesn't matter for navigation.
    date.setDate(1);
    date.setMonth(date.getMonth() + offset);
    setAnchorDate(toIsoDate(date));
  }

  function goToday() {
    setAnchorDate(todayIso());
    window.requestAnimationFrame(() => {
      if (!window.matchMedia("(max-width: 720px)").matches) return;
      todayRef.current?.scrollIntoView({ block: "start" });
    });
  }

  useEffect(() => {
    if (!dates.includes(today)) return;
    window.requestAnimationFrame(() => {
      if (!window.matchMedia("(max-width: 720px)").matches) return;
      todayRef.current?.scrollIntoView({ block: "start" });
    });
  }, [dates, today, filter]);

  return (
    <section className="month-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Month</p>
          <h1>月任务</h1>
          <p className="page-subtitle">按日历查看所有计划的新增与复习安排。</p>
        </div>
        <div className="month-heading-actions">
          <div className="month-filter" aria-label="任务类型筛选">
            {(["all", "learning", "task"] as const).map((item) => (
              <button
                type="button"
                className={filter === item ? "active" : ""}
                key={item}
                onClick={() => setFilter(item)}
              >
                {item === "all" ? "全部" : item === "learning" ? "学习" : "事项"}
              </button>
            ))}
          </div>
          <div className="month-controls">
          <button onClick={() => moveMonth(-1)} aria-label="上个月">
            <ChevronLeft size={17} />
          </button>
          <strong>{formatMonthTitle(anchorDate)}</strong>
          <button onClick={() => moveMonth(1)} aria-label="下个月">
            <ChevronRight size={17} />
          </button>
          <button onClick={goToday} aria-label="回到今天" className="month-today-button">
            <LocateFixed size={16} />
          </button>
          </div>
        </div>
      </div>

      <div className="month-calendar">
        {weekdayLabels.map((label) => (
          <div className="month-weekday" key={label}>
            {label}
          </div>
        ))}
        {dates.map((date) => {
          const dateEntries = entriesByDate.find((group) => group.date === date)?.entries ?? [];
          const outsideMonth = parseIsoDate(date).getMonth() !== currentMonth;
          const completed = dateEntries.filter((entry) => entry.completed).length;

          return (
            <article
              className={[
                "month-day",
                outsideMonth ? "outside" : "",
                date === today ? "today" : "",
              ].join(" ")}
              key={date}
            >
              <header>
                <span>{parseIsoDate(date).getDate()}</span>
                {dateEntries.length > 0 ? (
                  <small>
                    {completed}/{dateEntries.length}
                  </small>
                ) : null}
              </header>
              <div className="month-day-tasks">
                {dateEntries.map((entry) => {
                  const item = itemById.get(entry.knowledgeId);
                  const plan = planById.get(entry.planId);
                  if (!item || !plan) return null;
                  const theme = getPlanTheme(plan.themeId);
                  const overdue =
                    !entry.completed && Boolean(entry.originalDate) && entry.originalDate !== today;

                  return (
                    <div
                      className={[
                        "month-task",
                        entry.completed ? "completed" : "",
                        overdue ? "overdue" : "",
                      ].join(" ").trim()}
                      key={entry.id}
                      style={
                        {
                          "--task-accent": theme.accent,
                          "--task-soft": theme.accentSoft,
                        } as React.CSSProperties
                      }
                    >
                      <button
                        className="month-task-check"
                        disabled={entry.date !== today}
                        onClick={() => onToggleEntry(entry.id)}
                        aria-label={entry.completed ? "标记未完成" : "标记完成"}
                        title={
                          overdue
                            ? `已顺延到 ${formatChineseDate(entry.date)}，请到今日任务处理`
                            : undefined
                        }
                      >
                        <Check size={12} />
                      </button>
                      <button
                        className="month-task-title"
                        onClick={() => onOpenPlan(plan.id, entry.date)}
                        title={`${formatChineseDate(date)} · ${plan.name} · ${item.title}${
                          overdue ? ` · 已顺延到 ${formatChineseDate(entry.date)}` : ""
                        }`}
                      >
                        <span>{entryKindLabel(entry, plan)}</span>
                        {item.title}
                        {overdue ? <em className="month-task-overdue-mark">逾期</em> : null}
                      </button>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      <div className="month-mobile-list">
        {mobileDateGroups.map(({ date, entries }) => {
          const completed = entries.filter((entry) => entry.completed).length;
          return (
            <section
              className={date === today ? "month-mobile-day today" : "month-mobile-day"}
              key={date}
              ref={date === today ? todayRef : undefined}
            >
              <header>
                <div>
                  <strong>{formatChineseDate(date)}</strong>
                  <small>{completed}/{entries.length} 完成</small>
                </div>
              </header>
              <div className="month-mobile-tasks">
                {entries.length === 0 ? (
                  <p className="quiet-line">今天暂无安排。</p>
                ) : (
                  entries.map((entry) => {
                    const item = itemById.get(entry.knowledgeId);
                    const plan = planById.get(entry.planId);
                    if (!item || !plan) return null;
                    const theme = getPlanTheme(plan.themeId);
                    const overdue =
                      !entry.completed && Boolean(entry.originalDate) && entry.originalDate !== today;
                    return (
                      <article
                        className={[
                          "month-mobile-task",
                          entry.completed ? "completed" : "",
                          overdue ? "overdue" : "",
                        ].join(" ").trim()}
                        key={entry.id}
                        style={
                          {
                            "--task-accent": theme.accent,
                            "--task-soft": theme.accentSoft,
                          } as React.CSSProperties
                        }
                      >
                        <button
                          className="month-task-check"
                          disabled={entry.date !== today}
                          onClick={() => onToggleEntry(entry.id)}
                          aria-label={entry.completed ? "标记未完成" : "标记完成"}
                        >
                          <Check size={12} />
                        </button>
                        <button
                          className="month-mobile-task-body"
                          onClick={() => onOpenPlan(plan.id, entry.date)}
                        >
                          <span>{entryKindLabel(entry, plan)}</span>
                          <strong>{item.title}</strong>
                          <small>
                            {plan.name}
                            {overdue ? ` · 已顺延到 ${formatChineseDate(entry.date)}` : ""}
                          </small>
                        </button>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>

      <button
        type="button"
        className="month-floating-today-button"
        onClick={goToday}
        aria-label="回到今天"
      >
        <LocateFixed size={18} />
        <span>今天</span>
      </button>
    </section>
  );
}

function getDateEntries(
  date: string,
  scheduleEntries: ScheduleEntry[],
  filter: "all" | "learning" | "task",
  planById: Map<string, Plan>,
) {
  return scheduleEntries.filter((entry) => {
    // In the calendar we want each entry to show on its originally scheduled
    // day, not on the carried-to-today display date that TodayOverview uses.
    const bucketDate = entry.originalDate ?? entry.date;
    if (bucketDate !== date) return false;
    if (filter === "all") return true;
    return planById.get(entry.planId)?.kind === filter;
  });
}

function entryKindLabel(entry: ScheduleEntry, plan: Plan) {
  if (plan.kind === "task") return "事项";
  if (entry.kind === "new") return "新增";
  if (entry.kind === "remedial") return "补救";
  return "复习";
}
