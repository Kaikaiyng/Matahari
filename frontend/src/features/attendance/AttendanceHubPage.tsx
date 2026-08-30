import {
  Bell,
  CalendarCheck,
  Clock3,
  DoorOpen,
  LogIn,
  LogOut,
  Settings2,
  Tablet,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiRequest } from "../../api";
import { ClassesPage } from "../../components/ClassesPage";
import type { SchoolClassOption } from "../../components/ClassesPage";
import {
  CustomSelect,
  DataPanel,
  DatePicker,
  ModalFrame,
  PageHeader,
  StatCard,
  StatusBadge,
  TimePicker,
} from "../../components/AdminUi";
import "./AttendanceHubPage.css";

type Props = {
  permissions: string[];
  initialClassId?: number | null;
  onOpenStudent: (id: number, c: SchoolClassOption) => void;
  onUnauthorized: () => void;
};
type Tab = "overview" | "classes" | "devices" | "settings";
type StudentRow = {
  student_id: number;
  student_no: string;
  student_name: string;
  class_name: string | null;
  current_status: "on_campus" | "off_campus";
  first_entry: string | null;
  last_exit: string | null;
  is_late: boolean;
  is_early_leave: boolean;
  movement_count: number;
};
type Movement = {
  id: number;
  student_id: number;
  direction: "entry" | "exit";
  method: string;
  occurred_at: string;
  device_name: string | null;
  note: string | null;
};
type Campus = {
  date: string;
  summary: {
    recorded_students: number;
    on_campus: number;
    off_campus: number;
    late: number;
    early_leave: number;
  };
  students: StudentRow[];
  events: Movement[];
};
type Device = {
  id: number;
  name: string;
  vendor: string;
  external_device_id: string;
  direction_mode: string;
  status: string;
  location: string | null;
  has_credential: boolean;
  last_seen_at: string | null;
};
type Settings = {
  arrival_time: string;
  dismissal_time: string;
  notify_guardians_on_entry: boolean;
  notify_guardians_on_exit: boolean;
};
const today = () => new Date().toISOString().slice(0, 10);
const fmt = (v: string | null) =>
  v
    ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

export function AttendanceHubPage({
  permissions,
  initialClassId = null,
  onOpenStudent,
  onUnauthorized,
}: Props) {
  const canDevices = permissions.includes("attendance.devices.manage");
  const tabs = useMemo(
    () =>
      [
        ["overview", "Overview", CalendarCheck],
        ["classes", "Class Register", Users],
        ...(canDevices
          ? [
              ["devices", "Devices", Tablet],
              ["settings", "Settings", Settings2],
            ]
          : []),
      ] as Array<[Tab, string, typeof CalendarCheck]>,
    [canDevices],
  );
  const [tab, setTab] = useState<Tab>(initialClassId ? "classes" : "overview"),
    [date, setDate] = useState(today()),
    [campus, setCampus] = useState<Campus | null>(null);
  const [devices, setDevices] = useState<Device[]>([]),
    [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null),
    [selected, setSelected] = useState<StudentRow | null>(null),
    [refresh, setRefresh] = useState(0);
  const fail = useCallback(
    (e: unknown, m: string) => {
      if (e instanceof ApiError && e.status === 403) onUnauthorized();
      setError(m);
    },
    [onUnauthorized],
  );
  const loadCampus = useCallback(
    () =>
      apiRequest<{ data: Campus }>(
        `/v1/admin/attendance/campus-records?date=${date}`,
      )
        .then((r) => {
          setCampus(r.data);
          setError(null);
        })
        .catch((e) => fail(e, "Unable to load campus Attendance records.")),
    [date, fail],
  );
  useEffect(() => {
    if (tab === "overview") void loadCampus();
  }, [loadCampus, tab, refresh]);
  useEffect(() => {
    if (tab === "devices" && canDevices)
      void apiRequest<{ data: Device[] }>("/v1/admin/attendance/devices")
        .then((r) => setDevices(r.data))
        .catch((e) => fail(e, "Unable to load Attendance devices."));
    if (tab === "settings" && canDevices)
      void apiRequest<{ data: Settings }>("/v1/admin/attendance/settings")
        .then((r) => setSettings(r.data))
        .catch((e) => fail(e, "Unable to load Attendance settings."));
  }, [tab, refresh, canDevices, fail]);
  const movements = selected
    ? (campus?.events
        .filter((e) => e.student_id === selected.student_id)
        .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)) ?? [])
    : [];
  return (
    <section className="attendance-hub page-stack">
      <PageHeader
        eyebrow="School Operations"
        title="Attendance"
        description="Campus movements and class registers stay separate, while sharing one clear workspace."
        action={
          <label className="attendance-date">
            Date
            <DatePicker
              value={date}
              onChange={setDate}
              allowClear={false}
              ariaLabel="Attendance date"
            />
          </label>
        }
      />
      <nav className="attendance-hub-tabs">
        {tabs.map(([k, l, I]) => (
          <button
            key={k}
            type="button"
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
          >
            <I size={18} />
            {l}
          </button>
        ))}
      </nav>
      {error && (
        <p className="attendance-error" role="alert">
          {error}
        </p>
      )}
      {tab === "overview" && (
        <>
          <div className="attendance-stat-grid">
            <StatCard
              label="On campus"
              value={campus?.summary.on_campus ?? 0}
              tone="positive"
              icon={<LogIn />}
              meta="Latest movement is entry"
            />
            <StatCard
              label="Left campus"
              value={campus?.summary.off_campus ?? 0}
              icon={<LogOut />}
              meta="Latest movement is exit"
            />
            <StatCard
              label="Late arrivals"
              value={campus?.summary.late ?? 0}
              tone="warning"
              icon={<Clock3 />}
              meta="Based on school arrival time"
            />
            <StatCard
              label="Early leave"
              value={campus?.summary.early_leave ?? 0}
              tone="danger"
              icon={<DoorOpen />}
              meta="Before dismissal time"
            />
          </div>
          <CampusTable data={campus} select={setSelected} />
        </>
      )}
      {tab === "classes" && (
        <ClassesPage
          mode="attendance"
          permissions={permissions}
          initialClassId={initialClassId}
          onOpenStudent={onOpenStudent}
          onUnauthorized={onUnauthorized}
        />
      )}
      {tab === "devices" && (
        <DevicesPanel
          devices={devices}
          done={() => setRefresh((v) => v + 1)}
          fail={fail}
        />
      )}{" "}
      {tab === "settings" && settings && (
        <SettingsPanel value={settings} change={setSettings} fail={fail} />
      )}
      {selected && (
        <ModalFrame
          title={selected.student_name}
          description={`${selected.student_no} · ${selected.class_name ?? "No class"} · ${date}`}
          onClose={() => setSelected(null)}
          footer={
            <button
              className="secondary-button"
              type="button"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          }
        >
          <div className="movement-timeline">
            {movements.map((e) => (
              <article key={e.id} className={e.direction}>
                <span>{e.direction === "entry" ? <LogIn /> : <LogOut />}</span>
                <div>
                  <strong>
                    {e.direction === "entry" ? "Entered school" : "Left school"}
                  </strong>
                  <p>
                    {fmt(e.occurred_at)} · {e.method}
                    {e.device_name ? ` · ${e.device_name}` : ""}
                  </p>
                  {e.note && <small>{e.note}</small>}
                </div>
              </article>
            ))}
          </div>
        </ModalFrame>
      )}
    </section>
  );
}

function CampusTable({
  data,
  select,
}: {
  data: Campus | null;
  select: (s: StudentRow) => void;
}) {
  const rows = data?.students;
  return (
    <DataPanel
      eyebrow="Campus Attendance"
      title="Campus records"
      action={
        <span className="panel-count">
          {data?.summary.recorded_students ?? 0} recorded
        </span>
      }
    >
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Class</th>
              <th>Status</th>
              <th>First entry</th>
              <th>Last exit</th>
              <th>Flags</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows?.length ? (
              rows.map((s) => (
                <tr key={s.student_id}>
                  <td>
                    <strong>{s.student_name}</strong>
                    <small>{s.student_no}</small>
                  </td>
                  <td>{s.class_name ?? "—"}</td>
                  <td>
                    <StatusBadge
                      tone={
                        s.current_status === "on_campus"
                          ? "positive"
                          : "neutral"
                      }
                    >
                      {s.current_status === "on_campus" ? "On campus" : "Left"}
                    </StatusBadge>
                  </td>
                  <td>{fmt(s.first_entry)}</td>
                  <td>{fmt(s.last_exit)}</td>
                  <td>
                    <div className="attendance-flags">
                      {s.is_late && <span>Late</span>}
                      {s.is_early_leave && <span>Early leave</span>}
                      {!s.is_late && !s.is_early_leave && "—"}
                    </div>
                  </td>
                  <td>
                    <button
                      className="table-action"
                      type="button"
                      onClick={() => select(s)}
                    >
                      View detail
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="table-state-row">
                  No campus movements recorded for this date.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DataPanel>
  );
}

function DevicesPanel({
  devices,
  done,
  fail,
}: {
  devices: Device[];
  done: () => void;
  fail: (e: unknown, m: string) => void;
}) {
  const empty = {
      name: "",
      vendor: "hikvision",
      external_device_id: "",
      direction_mode: "bidirectional",
      status: "active",
      location: "",
      credential_secret: "",
    },
    [f, setF] = useState(empty);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest("/v1/admin/attendance/devices", {
        method: "POST",
        body: f,
      });
      setF(empty);
      done();
    } catch (x) {
      fail(x, "Unable to add Attendance device.");
    }
  };
  return (
    <div className="attendance-two-column">
      <DataPanel eyebrow="Hikvision-ready" title="Attendance devices">
        <div className="device-list">
          {devices.map((d) => (
            <article key={d.id}>
              <div>
                <strong>{d.name}</strong>
                <p>
                  {d.location || "Location not set"} · {d.external_device_id}
                </p>
              </div>
              <StatusBadge
                tone={d.status === "active" ? "positive" : "neutral"}
              >
                {d.status}
              </StatusBadge>
              <small>
                {d.vendor} · {d.direction_mode} ·{" "}
                {d.has_credential ? "Credential stored" : "No credential"}
              </small>
            </article>
          ))}
        </div>
      </DataPanel>
      <DataPanel eyebrow="Device setup" title="Add reader">
        <form className="attendance-form" onSubmit={save}>
          <label>
            Name
            <input
              required
              value={f.name}
              onChange={(e) => setF({ ...f, name: e.target.value })}
            />
          </label>
          <label>
            Device ID
            <input
              required
              value={f.external_device_id}
              onChange={(e) =>
                setF({ ...f, external_device_id: e.target.value })
              }
            />
          </label>
          <label>
            Location
            <input
              value={f.location}
              onChange={(e) => setF({ ...f, location: e.target.value })}
            />
          </label>
          <label>
            Direction
            <CustomSelect
              ariaLabel="Direction"
              value={f.direction_mode}
              onChange={(value) => setF({ ...f, direction_mode: value })}
              options={[
                { value: "bidirectional", label: "Bidirectional" },
                { value: "entry", label: "Entry" },
                { value: "exit", label: "Exit" },
              ]}
            />
          </label>
          <label>
            Credential / token
            <input
              type="password"
              value={f.credential_secret}
              onChange={(e) =>
                setF({ ...f, credential_secret: e.target.value })
              }
            />
            <small>Encrypted and never shown again.</small>
          </label>
          <button className="primary-button" type="submit">
            Add device
          </button>
        </form>
      </DataPanel>
    </div>
  );
}

function SettingsPanel({
  value,
  change,
  fail,
}: {
  value: Settings;
  change: (v: Settings) => void;
  fail: (e: unknown, m: string) => void;
}) {
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await apiRequest<{ data: Settings }>(
        "/v1/admin/attendance/settings",
        {
          method: "PUT",
          body: {
            ...value,
            arrival_time: value.arrival_time.slice(0, 5),
            dismissal_time: value.dismissal_time.slice(0, 5),
          },
        },
      );
      change(r.data);
    } catch (x) {
      fail(x, "Unable to save Attendance settings.");
    }
  };
  return (
    <DataPanel
      eyebrow="School-wide defaults"
      title="Campus Attendance settings"
    >
      <form className="attendance-form settings" onSubmit={save}>
        <label>
          Expected arrival time
          <TimePicker
            value={value.arrival_time.slice(0, 5)}
            onChange={(time) => change({ ...value, arrival_time: time })}
            ariaLabel="Expected arrival time"
          />
        </label>
        <label>
          Dismissal time
          <TimePicker
            value={value.dismissal_time.slice(0, 5)}
            onChange={(time) => change({ ...value, dismissal_time: time })}
            ariaLabel="Dismissal time"
          />
        </label>
        <label className="attendance-check">
          <input
            type="checkbox"
            checked={value.notify_guardians_on_entry}
            onChange={(e) =>
              change({ ...value, notify_guardians_on_entry: e.target.checked })
            }
          />
          <Bell />
          Notify guardians when a child enters school
        </label>
        <label className="attendance-check">
          <input
            type="checkbox"
            checked={value.notify_guardians_on_exit}
            onChange={(e) =>
              change({ ...value, notify_guardians_on_exit: e.target.checked })
            }
          />
          <Bell />
          Notify guardians when a child leaves school
        </label>
        <button className="primary-button" type="submit">
          Save settings
        </button>
      </form>
    </DataPanel>
  );
}
