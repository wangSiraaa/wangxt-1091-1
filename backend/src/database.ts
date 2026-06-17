import initSqlJs, { Database as SqlJsDatabase, Statement as SqlJsStatement } from "sql.js";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";

let db: Database;
let SqlJs: any;

class Statement {
  private stmt: SqlJsStatement;
  private sql: string;

  constructor(stmt: SqlJsStatement, sql: string) {
    this.stmt = stmt;
    this.sql = sql;
  }

  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    if (params.length === 1 && Array.isArray(params[0])) {
      params = params[0];
    }
    this.stmt.bind(params as any);
    this.stmt.step();
    const changes = this.stmt.getColumnNames().length > 0 ? 0 : 1;
    this.stmt.reset();
    return { changes, lastInsertRowid: 0 };
  }

  get(...params: any[]): any {
    if (params.length === 1 && Array.isArray(params[0])) {
      params = params[0];
    }
    this.stmt.bind(params as any);
    if (this.stmt.step()) {
      const row = this.stmt.getAsObject();
      this.stmt.reset();
      return row;
    }
    this.stmt.reset();
    return undefined;
  }

  all(...params: any[]): any[] {
    if (params.length === 1 && Array.isArray(params[0])) {
      params = params[0];
    }
    const results: any[] = [];
    this.stmt.bind(params as any);
    while (this.stmt.step()) {
      results.push(this.stmt.getAsObject());
    }
    this.stmt.reset();
    return results;
  }

  free() {
    this.stmt.free();
  }
}

class Database {
  private db: SqlJsDatabase;

  constructor(dbInstance: SqlJsDatabase) {
    this.db = dbInstance;
  }

  prepare(sql: string): Statement {
    const stmt = this.db.prepare(sql);
    return new Statement(stmt, sql);
  }

  exec(sql: string): void {
    this.db.run(sql);
  }

  pragma(sql: string): void {
    this.db.run(`PRAGMA ${sql}`);
  }

  transaction(fn: () => void): () => void {
    return () => {
      this.db.run("BEGIN TRANSACTION");
      try {
        fn();
        this.db.run("COMMIT");
      } catch (e) {
        this.db.run("ROLLBACK");
        throw e;
      }
    };
  }

  close() {
    this.db.close();
  }

  export(): Uint8Array {
    return this.db.export();
  }
}

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  SqlJs = await initSqlJs({
    locateFile: (file: string) => {
      const localPath = path.join(__dirname, "..", "node_modules", "sql.js", "dist", file);
      if (fs.existsSync(localPath)) {
        return localPath;
      }
      return `https://sql.js.org/dist/${file}`;
    },
  });

  const dbPath = process.env.DB_PATH || path.join(process.cwd(), "data", "hospital.db");

  let dbInstance: SqlJsDatabase;
  try {
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      dbInstance = new SqlJs.Database(buffer);
    } else {
      dbInstance = new SqlJs.Database();
    }
  } catch (e) {
    console.warn("无法加载数据库文件，使用内存数据库:", e);
    dbInstance = new SqlJs.Database();
  }

  db = new Database(dbInstance);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
  `);

  createTables();
  seedData();

  saveDatabase(dbPath);

  setInterval(() => {
    try {
      saveDatabase(dbPath);
    } catch (e) {
      console.error("保存数据库失败:", e);
    }
  }, 5000);

  return db;
}

function saveDatabase(dbPath: string) {
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  } catch (e) {
    console.warn("保存数据库失败（可能是只读文件系统）:", e);
  }
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      gender TEXT,
      age INTEGER,
      bed_no TEXT,
      ward TEXT,
      department TEXT,
      phone TEXT,
      id_card_no TEXT,
      is_isolated INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nurses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      employee_no TEXT,
      ward TEXT,
      department TEXT,
      phone TEXT,
      status TEXT DEFAULT 'on_duty',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS escorts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      employee_no TEXT,
      phone TEXT,
      status TEXT DEFAULT 'offline',
      is_specialist INTEGER DEFAULT 0,
      current_task_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS check_orders (
      id TEXT PRIMARY KEY,
      order_no TEXT NOT NULL UNIQUE,
      patient_id TEXT NOT NULL,
      check_type TEXT NOT NULL,
      check_item TEXT NOT NULL,
      check_room TEXT,
      appointment_time TEXT,
      status TEXT DEFAULT 'pending',
      priority TEXT DEFAULT 'normal',
      remark TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS check_requests (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      nurse_id TEXT NOT NULL,
      escort_id TEXT,
      check_order_id TEXT,
      check_type TEXT NOT NULL,
      check_item TEXT,
      check_room TEXT,
      urgency TEXT DEFAULT 'normal',
      priority INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      wait_started_at TEXT,
      assigned_at TEXT,
      accepted_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      settled_at TEXT,
      settlement_amount REAL,
      remark TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS request_logs (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      action TEXT NOT NULL,
      operator_id TEXT,
      operator_role TEXT,
      operator_name TEXT,
      remark TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      department TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_requests_status ON check_requests(status);
    CREATE INDEX IF NOT EXISTS idx_requests_patient ON check_requests(patient_id);
    CREATE INDEX IF NOT EXISTS idx_requests_escort ON check_requests(escort_id);
    CREATE INDEX IF NOT EXISTS idx_requests_created ON check_requests(created_at);
    CREATE INDEX IF NOT EXISTS idx_logs_request ON request_logs(request_id);
  `);
}

function seedData() {
  const wardResult = db.prepare("SELECT COUNT(*) as count FROM wards").get();
  if (wardResult && wardResult.count > 0) return;

  const currentTime = dayjs().format("YYYY-MM-DD HH:mm:ss");

  const wardIds: string[] = [];
  const wards = [
    { name: "内科一病区", department: "内科" },
    { name: "内科二病区", department: "内科" },
    { name: "外科一病区", department: "外科" },
    { name: "外科二病区", department: "外科" },
    { name: "ICU病区", department: "重症医学科" },
    { name: "儿科病区", department: "儿科" },
  ];

  const insertWard = db.prepare("INSERT INTO wards (id, name, department, created_at) VALUES (?, ?, ?, ?)");
  wards.forEach((w) => {
    const id = uuidv4();
    wardIds.push(id);
    insertWard.run(id, w.name, w.department, currentTime);
  });

  const patientIds: string[] = [];
  const patients = [
    { name: "张三", gender: "male", age: 45, bed_no: "A101", ward: "内科一病区", department: "内科", phone: "13800138001", is_isolated: 0 },
    { name: "李四", gender: "female", age: 32, bed_no: "A102", ward: "内科一病区", department: "内科", phone: "13800138002", is_isolated: 0 },
    { name: "王五", gender: "male", age: 58, bed_no: "A103", ward: "内科一病区", department: "内科", phone: "13800138003", is_isolated: 1 },
    { name: "赵六", gender: "female", age: 28, bed_no: "B201", ward: "外科一病区", department: "外科", phone: "13800138004", is_isolated: 0 },
    { name: "钱七", gender: "male", age: 67, bed_no: "B202", ward: "外科一病区", department: "外科", phone: "13800138005", is_isolated: 1 },
    { name: "孙八", gender: "female", age: 41, bed_no: "C301", ward: "ICU病区", department: "重症医学科", phone: "13800138006", is_isolated: 0 },
  ];

  const insertPatient = db.prepare(
    "INSERT INTO patients (id, name, gender, age, bed_no, ward, department, phone, is_isolated, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  patients.forEach((p) => {
    const id = uuidv4();
    patientIds.push(id);
    insertPatient.run(id, p.name, p.gender, p.age, p.bed_no, p.ward, p.department, p.phone, p.is_isolated, currentTime, currentTime);
  });

  const nurses = [
    { name: "护士小王", employee_no: "N001", ward: "内科一病区", department: "内科", phone: "13900139001", status: "on_duty" },
    { name: "护士小李", employee_no: "N002", ward: "内科一病区", department: "内科", phone: "13900139002", status: "on_duty" },
    { name: "护士小张", employee_no: "N003", ward: "外科一病区", department: "外科", phone: "13900139003", status: "on_duty" },
    { name: "护士小刘", employee_no: "N004", ward: "ICU病区", department: "重症医学科", phone: "13900139004", status: "on_duty" },
  ];

  const insertNurse = db.prepare(
    "INSERT INTO nurses (id, name, employee_no, ward, department, phone, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );
  nurses.forEach((n) => {
    const id = uuidv4();
    insertNurse.run(id, n.name, n.employee_no, n.ward, n.department, n.phone, n.status, currentTime, currentTime);
  });

  const escorts = [
    { name: "陪检员老赵", employee_no: "E001", phone: "13700137001", status: "online", is_specialist: 0 },
    { name: "陪检员老钱", employee_no: "E002", phone: "13700137002", status: "online", is_specialist: 0 },
    { name: "陪检员老孙", employee_no: "E003", phone: "13700137003", status: "online", is_specialist: 1 },
    { name: "陪检员老李", employee_no: "E004", phone: "13700137004", status: "offline", is_specialist: 1 },
  ];

  const insertEscort = db.prepare(
    "INSERT INTO escorts (id, name, employee_no, phone, status, is_specialist, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  escorts.forEach((e) => {
    const id = uuidv4();
    insertEscort.run(id, e.name, e.employee_no, e.phone, e.status, e.is_specialist, currentTime, currentTime);
  });

  const orders = [
    { order_no: "CO202401001", patientIdx: 0, checkType: "CT", checkItem: "胸部CT平扫", checkRoom: "CT室1号", priority: "normal" },
    { order_no: "CO202401002", patientIdx: 1, checkType: "MRI", checkItem: "头颅MRI", checkRoom: "MRI室", priority: "urgent" },
    { order_no: "CO202401003", patientIdx: 2, checkType: "B超", checkItem: "腹部B超", checkRoom: "B超室2号", priority: "normal" },
    { order_no: "CO202401004", patientIdx: 3, checkType: "X光", checkItem: "胸部正位片", checkRoom: "X光室1号", priority: "normal" },
    { order_no: "CO202401005", patientIdx: 4, checkType: "CT", checkItem: "腹部CT增强", checkRoom: "CT室2号", priority: "emergency" },
  ];

  const insertOrder = db.prepare(
    "INSERT INTO check_orders (id, order_no, patient_id, check_type, check_item, check_room, priority, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)"
  );
  orders.forEach((o) => {
    const id = uuidv4();
    insertOrder.run(id, o.order_no, patientIds[o.patientIdx], o.checkType, o.checkItem, o.checkRoom, o.priority, currentTime, currentTime);
  });
}

export function now(): string {
  return dayjs().format("YYYY-MM-DD HH:mm:ss");
}

export { db, uuidv4, Database };
