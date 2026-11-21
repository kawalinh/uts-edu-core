import React, { useMemo, useState } from 'react';
import {
  Building2,
  ClipboardCheck,
  DoorOpen,
  Edit3,
  GraduationCap,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useUTS } from '../../context/UTSContext';
import { ROOM_TYPE_LABELS, formatRoomTypesList } from '../../engine/conflictEngine';
import type { Building, Classroom, ExamModel, Faculty, RoomStatus, RoomType } from '../../types/uts';
import { ExportToolbar } from '../common/ExportToolbar';

type CatalogTab = 'BUILDINGS' | 'FACULTIES' | 'ROOMS' | 'EXAM_MODELS';

const ALL_ROOM_TYPES: RoomType[] = ['THEORY', 'LAB_COMP', 'HALL', 'LAB_PHYSICS', 'LAB_LANG'];

export const MasterCatalogManager: React.FC = () => {
  const {
    state,
    hasPermission,
    createBuilding,
    updateBuilding,
    deleteBuilding,
    createFaculty,
    updateFaculty,
    deleteFaculty,
    createClassroom,
    updateClassroom,
    deleteClassroom,
    createExamModel,
    updateExamModel,
    deleteExamModel,
  } = useUTS();

  const [subTab, setSubTab] = useState<CatalogTab>('BUILDINGS');
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // ---- BUILDING FORM STATE ----
  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null);
  const [bldCode, setBldCode] = useState('');
  const [bldName, setBldName] = useState('');
  const [bldCampus, setBldCampus] = useState<'CS1_MAIN' | 'CS2_TECH'>('CS1_MAIN');
  const [bldFloors, setBldFloors] = useState(5);
  const [bldDistance, setBldDistance] = useState(1);

  // ---- FACULTY FORM STATE ----
  const [editingFacultyId, setEditingFacultyId] = useState<string | null>(null);
  const [facCode, setFacCode] = useState('');
  const [facName, setFacName] = useState('');
  const [facDean, setFacDean] = useState('');
  const [facTarget, setFacTarget] = useState(900);
  const [facCompleted, setFacCompleted] = useState(0);

  // ---- CLASSROOM FORM STATE ----
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [rmCode, setRmCode] = useState('');
  const [rmName, setRmName] = useState('');
  const [rmBuildingId, setRmBuildingId] = useState(state.buildings[0]?.buildingId ?? 'BLD_A1');
  const [rmType, setRmType] = useState<RoomType>('THEORY');
  const [rmCapacity, setRmCapacity] = useState(60);
  const [rmFloor, setRmFloor] = useState(2);
  const [rmStatus, setRmStatus] = useState<RoomStatus>('AVAILABLE');

  // ---- EXAM MODEL FORM STATE ----
  const [editingExamModelId, setEditingExamModelId] = useState<string | null>(null);
  const [emCode, setEmCode] = useState('');
  const [emName, setEmName] = useState('');
  const [emBaseMode, setEmBaseMode] = useState<'MODULAR' | 'CONSOLIDATED'>('CONSOLIDATED');
  const [emDuration, setEmDuration] = useState(90);
  const [emPeriods, setEmPeriods] = useState(2);
  const [emProctorRatio, setEmProctorRatio] = useState(25);
  const [emFillPercent, setEmFillPercent] = useState(50);
  const [emRoomTypes, setEmRoomTypes] = useState<RoomType[]>(['THEORY', 'HALL']);
  const [emDescription, setEmDescription] = useState('');

  // Permissions
  const canCreateBld = hasPermission('MASTER_BUILDINGS', 'create');
  const canUpdateBld = hasPermission('MASTER_BUILDINGS', 'update');
  const canDeleteBld = hasPermission('MASTER_BUILDINGS', 'delete');

  const canCreateFac = hasPermission('MASTER_FACULTIES', 'create');
  const canUpdateFac = hasPermission('MASTER_FACULTIES', 'update');
  const canDeleteFac = hasPermission('MASTER_FACULTIES', 'delete');

  const canCreateRoom = hasPermission('MASTER_ROOMS', 'create');
  const canUpdateRoom = hasPermission('MASTER_ROOMS', 'update');
  const canDeleteRoom = hasPermission('MASTER_ROOMS', 'delete');

  const canCreateEM = hasPermission('MASTER_EXAM_MODELS', 'create');
  const canUpdateEM = hasPermission('MASTER_EXAM_MODELS', 'update');
  const canDeleteEM = hasPermission('MASTER_EXAM_MODELS', 'delete');

  const q = search.trim().toLowerCase();

  const filteredBuildings = useMemo(
    () =>
      state.buildings.filter((b) =>
        !q || `${b.buildingCode} ${b.buildingName} ${b.campusName}`.toLowerCase().includes(q)
      ),
    [state.buildings, q]
  );

  const filteredFaculties = useMemo(
    () =>
      state.faculties.filter((f) =>
        !q || `${f.code} ${f.name} ${f.deanName}`.toLowerCase().includes(q)
      ),
    [state.faculties, q]
  );

  const filteredRooms = useMemo(
    () =>
      state.classrooms.filter((r) => {
        const b = state.buildings.find((x) => x.buildingId === r.buildingId);
        return (
          !q ||
          `${r.roomCode} ${r.roomName} ${ROOM_TYPE_LABELS[r.roomType]} ${b?.buildingCode ?? ''}`
            .toLowerCase()
            .includes(q)
        );
      }),
    [state.classrooms, state.buildings, q]
  );

  const filteredExamModels = useMemo(
    () =>
      state.examModels.filter((m) =>
        !q || `${m.code} ${m.name} ${m.description}`.toLowerCase().includes(q)
      ),
    [state.examModels, q]
  );

  // ---- BUILDING HANDLERS ----
  const resetBldForm = () => {
    setEditingBuildingId(null);
    setBldCode('');
    setBldName('');
    setBldCampus('CS1_MAIN');
    setBldFloors(5);
    setBldDistance(1);
  };

  const startEditBuilding = (b: Building) => {
    setEditingBuildingId(b.buildingId);
    setBldCode(b.buildingCode);
    setBldName(b.buildingName);
    setBldCampus(b.campusCode);
    setBldFloors(b.totalFloors);
    setBldDistance(b.distanceGroup);
  };

  const submitBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<Building> = {
      buildingCode: bldCode,
      buildingName: bldName,
      campusCode: bldCampus,
      campusName:
        bldCampus === 'CS2_TECH' ? 'Cơ sở 2 — Khu Thực hành Công nghệ' : 'Cơ sở 1 — Trung tâm',
      totalFloors: bldFloors,
      distanceGroup: bldDistance,
    };
    const res = editingBuildingId
      ? await updateBuilding(editingBuildingId, payload)
      : await createBuilding(payload);
    if (res.ok) resetBldForm();
  };

  // ---- FACULTY HANDLERS ----
  const resetFacForm = () => {
    setEditingFacultyId(null);
    setFacCode('');
    setFacName('');
    setFacDean('');
    setFacTarget(900);
    setFacCompleted(0);
  };

  const startEditFaculty = (f: Faculty) => {
    setEditingFacultyId(f.facultyId);
    setFacCode(f.code);
    setFacName(f.name);
    setFacDean(f.deanName);
    setFacTarget(f.targetHours);
    setFacCompleted(f.completedHours);
  };

  const submitFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<Faculty> = {
      code: facCode,
      name: facName,
      deanName: facDean,
      targetHours: facTarget,
      completedHours: facCompleted,
    };
    const res = editingFacultyId
      ? await updateFaculty(editingFacultyId, payload)
      : await createFaculty(payload);
    if (res.ok) resetFacForm();
  };

  // ---- CLASSROOM HANDLERS ----
  const resetRoomForm = () => {
    setEditingRoomId(null);
    setRmCode('');
    setRmName('');
    setRmBuildingId(state.buildings[0]?.buildingId ?? 'BLD_A1');
    setRmType('THEORY');
    setRmCapacity(60);
    setRmFloor(2);
    setRmStatus('AVAILABLE');
  };

  const startEditRoom = (r: Classroom) => {
    setEditingRoomId(r.roomId);
    setRmCode(r.roomCode);
    setRmName(r.roomName);
    setRmBuildingId(r.buildingId);
    setRmType(r.roomType);
    setRmCapacity(r.maxCapacity);
    setRmFloor(r.floorNumber);
    setRmStatus(r.operationalStatus);
  };

  const submitRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<Classroom> = {
      roomCode: rmCode,
      roomName: rmName,
      buildingId: rmBuildingId,
      roomType: rmType,
      maxCapacity: rmCapacity,
      floorNumber: rmFloor,
      operationalStatus: rmStatus,
    };
    const res = editingRoomId
      ? await updateClassroom(editingRoomId, payload)
      : await createClassroom(payload);
    if (res.ok) resetRoomForm();
  };

  // ---- EXAM MODEL HANDLERS ----
  const resetExamModelForm = () => {
    setEditingExamModelId(null);
    setEmCode('');
    setEmName('');
    setEmBaseMode('CONSOLIDATED');
    setEmDuration(90);
    setEmPeriods(2);
    setEmProctorRatio(25);
    setEmFillPercent(50);
    setEmRoomTypes(['THEORY', 'HALL']);
    setEmDescription('');
  };

  const startEditExamModel = (m: ExamModel) => {
    setEditingExamModelId(m.modelId);
    setEmCode(m.code);
    setEmName(m.name);
    setEmBaseMode(m.baseMode);
    setEmDuration(m.durationMinutes);
    setEmPeriods(m.periodsRequired);
    setEmProctorRatio(m.studentsPerProctor);
    setEmFillPercent(m.maxRoomFillPercent);
    setEmRoomTypes(m.allowedRoomTypes);
    setEmDescription(m.description);
  };

  const toggleEmRoomType = (rt: RoomType) => {
    setEmRoomTypes((prev) =>
      prev.includes(rt)
        ? prev.length > 1
          ? prev.filter((x) => x !== rt)
          : prev
        : [...prev, rt]
    );
  };

  const submitExamModel = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Partial<ExamModel> = {
      code: emCode,
      name: emName,
      baseMode: emBaseMode,
      durationMinutes: emDuration,
      periodsRequired: emPeriods,
      studentsPerProctor: emProctorRatio,
      maxRoomFillPercent: emFillPercent,
      allowedRoomTypes: emRoomTypes,
      description: emDescription,
    };
    const res = editingExamModelId
      ? await updateExamModel(editingExamModelId, payload)
      : await createExamModel(payload);
    if (res.ok) resetExamModelForm();
  };

  return (
    <div className="space-y-4">
      {/* Sub-Catalog Switcher + Search */}
      <div className="x_panel px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'BUILDINGS', label: `Tòa nhà (${state.buildings.length})`, icon: Building2 },
              { id: 'FACULTIES', label: `Khoa đào tạo (${state.faculties.length})`, icon: GraduationCap },
              { id: 'ROOMS', label: `Phòng học (${state.classrooms.length})`, icon: DoorOpen },
              { id: 'EXAM_MODELS', label: `Mô hình thi (${state.examModels.length})`, icon: ClipboardCheck },
            ] as { id: CatalogTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
          ).map((item) => {
            const Icon = item.icon;
            const active = subTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSubTab(item.id);
                  setSearch('');
                  setConfirmDeleteId(null);
                }}
                className={`px-3 py-1.5 rounded text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  active ? 'bg-[#1ABB9C] text-white' : 'bg-[#F2F5F7] text-[#5A738E] hover:text-[#2A3F54]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#73879C] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm nhanh danh mục..."
            className="border border-[#D9DEE4] rounded pl-8 pr-3 py-1.5 text-xs bg-white w-[220px]"
          />
        </div>
      </div>

      {/* 1. BUILDINGS CRUD */}
      {subTab === 'BUILDINGS' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <section className="x_panel xl:col-span-8">
            <div className="x_title flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-bold text-[#2A3F54]">
                  Danh mục Tòa nhà & Cơ sở Đào tạo ({filteredBuildings.length})
                </h2>
                <p className="text-xs text-[#73879C] mt-0.5">
                  Đồng bộ trực tiếp với Danh mục Phòng học, Lưới xếp lịch và kiểm tra khoảng cách di chuyển BR_RULE_09 (&gt;500m)
                </p>
              </div>
              <ExportToolbar
                compact
                filenameBase="UTS_Master_ToaNha"
                reportTitle="Danh mục Master Data Tòa nhà & Cơ sở"
                columns={[
                  { header: 'Mã Tòa nhà', accessor: (b) => b.buildingCode },
                  { header: 'Tên Tòa nhà', accessor: (b) => b.buildingName },
                  { header: 'Cơ sở', accessor: (b) => b.campusName },
                  { header: 'Số tầng', accessor: (b) => b.totalFloors },
                  { header: 'Nhóm khoảng cách', accessor: (b) => `Cụm ${b.distanceGroup}` },
                  {
                    header: 'Số phòng trực thuộc',
                    accessor: (b) => state.classrooms.filter((r) => r.buildingId === b.buildingId).length,
                  },
                ]}
                rows={filteredBuildings}
              />
            </div>

            <div className="x_content overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#E6E9ED] text-[#5A738E] text-left">
                    <th className="py-2 pr-2 font-semibold">Mã & Tên Tòa nhà</th>
                    <th className="py-2 px-2 font-semibold">Cơ sở Đào tạo</th>
                    <th className="py-2 px-2 font-semibold">Số tầng</th>
                    <th className="py-2 px-2 font-semibold">Cụm khoảng cách</th>
                    <th className="py-2 px-2 font-semibold">Phòng học</th>
                    <th className="py-2 pl-2 text-right font-semibold">Thao tác CRUD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E9ED]">
                  {filteredBuildings.map((b) => {
                    const roomCount = state.classrooms.filter((r) => r.buildingId === b.buildingId).length;
                    return (
                      <tr key={b.buildingId} className="hover:bg-[#F7F7F7]">
                        <td className="py-2.5 pr-2">
                          <span className="font-mono font-bold text-[#2A3F54]">{b.buildingCode}</span>
                          <div className="text-[#5A738E]">{b.buildingName}</div>
                        </td>
                        <td className="py-2.5 px-2">
                          <span className="font-mono text-[11px] font-semibold text-[#169F85]">{b.campusCode}</span>
                          <div className="text-[11px] text-[#73879C]">{b.campusName}</div>
                        </td>
                        <td className="py-2.5 px-2 font-mono">{b.totalFloors} tầng</td>
                        <td className="py-2.5 px-2 font-mono">Cụm {b.distanceGroup}</td>
                        <td className="py-2.5 px-2 font-mono font-semibold text-[#2A3F54]">{roomCount} phòng</td>
                        <td className="py-2.5 pl-2 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {canUpdateBld && (
                              <button
                                type="button"
                                onClick={() => startEditBuilding(b)}
                                className="px-2 py-1 rounded border border-[#3498DB] text-[#3498DB] hover:bg-[#EFF6FF] font-semibold inline-flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" /> Sửa
                              </button>
                            )}
                            {canDeleteBld &&
                              (confirmDeleteId === b.buildingId ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await deleteBuilding(b.buildingId);
                                      setConfirmDeleteId(null);
                                    }}
                                    className="px-2 py-1 rounded bg-[#E74C3C] text-white font-semibold"
                                  >
                                    Xác nhận xóa
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="p-1 text-[#73879C] hover:text-[#2A3F54]"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(b.buildingId)}
                                  className="px-2 py-1 rounded border border-[#FCA5A5] text-[#B91C1C] hover:bg-[#FEF2F2] font-semibold inline-flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" /> Xóa
                                </button>
                              ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="x_panel xl:col-span-4">
            <div className="x_title flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#2A3F54] flex items-center gap-1.5">
                {editingBuildingId ? (
                  <Edit3 className="w-4 h-4 text-[#3498DB]" />
                ) : (
                  <Plus className="w-4 h-4 text-[#1ABB9C]" />
                )}
                {editingBuildingId ? 'Chỉnh sửa Tòa nhà' : 'Thêm mới Tòa nhà'}
              </h3>
              {editingBuildingId && (
                <button
                  type="button"
                  onClick={resetBldForm}
                  className="text-xs text-[#73879C] hover:text-[#2A3F54] underline"
                >
                  Hủy sửa
                </button>
              )}
            </div>
            <form onSubmit={submitBuilding} className="x_content space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Mã Tòa nhà *</label>
                <input
                  required
                  value={bldCode}
                  onChange={(e) => setBldCode(e.target.value)}
                  placeholder="VD: D1, E2"
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Tên Tòa nhà *</label>
                <input
                  required
                  value={bldName}
                  onChange={(e) => setBldName(e.target.value)}
                  placeholder="VD: Trung tâm Thí nghiệm D1"
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Cơ sở trực thuộc</label>
                <select
                  value={bldCampus}
                  onChange={(e) => {
                    const val = e.target.value as 'CS1_MAIN' | 'CS2_TECH';
                    setBldCampus(val);
                    setBldDistance(val === 'CS2_TECH' ? 2 : 1);
                  }}
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white"
                >
                  <option value="CS1_MAIN">Cơ sở 1 — Trung tâm (CS1_MAIN)</option>
                  <option value="CS2_TECH">Cơ sở 2 — Khu Thực hành Công nghệ (CS2_TECH)</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">Số tầng</label>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={bldFloors}
                    onChange={(e) => setBldFloors(Number(e.target.value))}
                    className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">Cụm khoảng cách</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={bldDistance}
                    onChange={(e) => setBldDistance(Number(e.target.value))}
                    className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={editingBuildingId ? !canUpdateBld : !canCreateBld}
                className="w-full py-2 rounded bg-[#1ABB9C] hover:bg-[#169F85] disabled:opacity-40 text-white font-semibold"
              >
                {editingBuildingId ? 'Lưu cập nhật Tòa nhà' : 'Thêm mới Tòa nhà'}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* 2. FACULTIES CRUD */}
      {subTab === 'FACULTIES' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <section className="x_panel xl:col-span-8">
            <div className="x_title flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-bold text-[#2A3F54]">
                  Danh mục Khoa Đào tạo ({filteredFaculties.length})
                </h2>
                <p className="text-xs text-[#73879C] mt-0.5">
                  Tự động đồng bộ sang Dashboard KPI, Bộ lọc Khoa, Học phần, Giảng viên và Cây tổ chức đào tạo
                </p>
              </div>
              <ExportToolbar
                compact
                filenameBase="UTS_Master_KhoaDaoTao"
                reportTitle="Danh mục Master Data Khoa Đào tạo"
                columns={[
                  { header: 'Mã Khoa', accessor: (f) => f.code },
                  { header: 'Tên Khoa', accessor: (f) => f.name },
                  { header: 'Trưởng Khoa', accessor: (f) => f.deanName },
                  { header: 'Định mức giờ chuẩn', accessor: (f) => f.targetHours },
                  { header: 'Giờ đã thực hiện', accessor: (f) => f.completedHours },
                  {
                    header: 'Số Học phần',
                    accessor: (f) => state.courses.filter((c) => c.facultyId === f.facultyId).length,
                  },
                ]}
                rows={filteredFaculties}
              />
            </div>

            <div className="x_content overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#E6E9ED] text-[#5A738E] text-left">
                    <th className="py-2 pr-2 font-semibold">Mã & Tên Khoa</th>
                    <th className="py-2 px-2 font-semibold">Trưởng Khoa</th>
                    <th className="py-2 px-2 font-semibold">Định mức / Tiến độ</th>
                    <th className="py-2 px-2 font-semibold">Quy mô dữ liệu</th>
                    <th className="py-2 pl-2 text-right font-semibold">Thao tác CRUD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E9ED]">
                  {filteredFaculties.map((f) => {
                    const cCount = state.courses.filter((c) => c.facultyId === f.facultyId).length;
                    const iCount = state.instructors.filter((i) => i.facultyId === f.facultyId).length;
                    const pct = f.targetHours > 0 ? Math.min(100, Math.round((f.completedHours / f.targetHours) * 100)) : 0;
                    return (
                      <tr key={f.facultyId} className="hover:bg-[#F7F7F7]">
                        <td className="py-2.5 pr-2">
                          <span className="font-mono font-bold text-[#2A3F54]">{f.code}</span>
                          <div className="text-[#5A738E] font-medium">{f.name}</div>
                        </td>
                        <td className="py-2.5 px-2 text-[#2A3F54]">{f.deanName}</td>
                        <td className="py-2.5 px-2 min-w-[140px]">
                          <div className="font-mono text-[11px] text-[#2A3F54]">
                            {f.completedHours} / {f.targetHours} giờ ({pct}%)
                          </div>
                          <div className="w-full h-1.5 bg-[#E6E9ED] rounded overflow-hidden mt-1">
                            <div className="h-full bg-[#1ABB9C]" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td className="py-2.5 px-2 font-mono text-[11px] text-[#5A738E]">
                          {cCount} HP · {iCount} GV
                        </td>
                        <td className="py-2.5 pl-2 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {canUpdateFac && (
                              <button
                                type="button"
                                onClick={() => startEditFaculty(f)}
                                className="px-2 py-1 rounded border border-[#3498DB] text-[#3498DB] hover:bg-[#EFF6FF] font-semibold inline-flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" /> Sửa
                              </button>
                            )}
                            {canDeleteFac &&
                              (confirmDeleteId === f.facultyId ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await deleteFaculty(f.facultyId);
                                      setConfirmDeleteId(null);
                                    }}
                                    className="px-2 py-1 rounded bg-[#E74C3C] text-white font-semibold"
                                  >
                                    Xác nhận
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="p-1 text-[#73879C]"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(f.facultyId)}
                                  className="px-2 py-1 rounded border border-[#FCA5A5] text-[#B91C1C] hover:bg-[#FEF2F2] font-semibold inline-flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" /> Xóa
                                </button>
                              ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="x_panel xl:col-span-4">
            <div className="x_title flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#2A3F54] flex items-center gap-1.5">
                {editingFacultyId ? <Edit3 className="w-4 h-4 text-[#3498DB]" /> : <Plus className="w-4 h-4 text-[#1ABB9C]" />}
                {editingFacultyId ? 'Chỉnh sửa Khoa đào tạo' : 'Thêm mới Khoa đào tạo'}
              </h3>
              {editingFacultyId && (
                <button type="button" onClick={resetFacForm} className="text-xs text-[#73879C] underline">
                  Hủy sửa
                </button>
              )}
            </div>
            <form onSubmit={submitFaculty} className="x_content space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Mã Khoa *</label>
                <input
                  required
                  value={facCode}
                  onChange={(e) => setFacCode(e.target.value)}
                  placeholder="VD: LUAT, CK-CDT"
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Tên Khoa *</label>
                <input
                  required
                  value={facName}
                  onChange={(e) => setFacName(e.target.value)}
                  placeholder="VD: Khoa Luật Kinh tế & Hành chính"
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Trưởng Khoa</label>
                <input
                  value={facDean}
                  onChange={(e) => setFacDean(e.target.value)}
                  placeholder="VD: PGS.TS. Nguyễn Văn C"
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">Định mức giờ kỳ</label>
                  <input
                    type="number"
                    min={100}
                    value={facTarget}
                    onChange={(e) => setFacTarget(Number(e.target.value))}
                    className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">Giờ đã hoàn thành</label>
                  <input
                    type="number"
                    min={0}
                    value={facCompleted}
                    onChange={(e) => setFacCompleted(Number(e.target.value))}
                    className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={editingFacultyId ? !canUpdateFac : !canCreateFac}
                className="w-full py-2 rounded bg-[#1ABB9C] hover:bg-[#169F85] disabled:opacity-40 text-white font-semibold"
              >
                {editingFacultyId ? 'Lưu cập nhật Khoa' : 'Thêm mới Khoa'}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* 3. CLASSROOMS CRUD */}
      {subTab === 'ROOMS' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <section className="x_panel xl:col-span-8">
            <div className="x_title flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-bold text-[#2A3F54]">
                  Danh mục Phòng học, Phòng Lab & Hội trường ({filteredRooms.length})
                </h2>
                <p className="text-xs text-[#73879C] mt-0.5">
                  Đồng bộ trực tiếp với Lưới xếp lịch, Conflict Engine (sức chứa & loại phòng), CSP Solver và Lịch thi
                </p>
              </div>
              <ExportToolbar
                compact
                filenameBase="UTS_Master_PhongHoc"
                reportTitle="Danh mục Master Data Phòng học & Sức chứa"
                columns={[
                  { header: 'Mã phòng', accessor: (r) => r.roomCode },
                  { header: 'Tên phòng', accessor: (r) => r.roomName },
                  {
                    header: 'Tòa nhà',
                    accessor: (r) => state.buildings.find((b) => b.buildingId === r.buildingId)?.buildingCode ?? '',
                  },
                  { header: 'Loại phòng', accessor: (r) => ROOM_TYPE_LABELS[r.roomType] },
                  { header: 'Sức chứa', accessor: (r) => r.maxCapacity },
                  { header: 'Tầng', accessor: (r) => r.floorNumber },
                  { header: 'Trạng thái', accessor: (r) => r.operationalStatus },
                ]}
                rows={filteredRooms}
              />
            </div>

            <div className="x_content overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#E6E9ED] text-[#5A738E] text-left">
                    <th className="py-2 pr-2 font-semibold">Mã & Tên Phòng</th>
                    <th className="py-2 px-2 font-semibold">Tòa nhà / Tầng</th>
                    <th className="py-2 px-2 font-semibold">Loại phòng</th>
                    <th className="py-2 px-2 font-semibold">Sức chứa</th>
                    <th className="py-2 px-2 font-semibold">Trạng thái</th>
                    <th className="py-2 pl-2 text-right font-semibold">Thao tác CRUD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E9ED]">
                  {filteredRooms.map((r) => {
                    const bld = state.buildings.find((b) => b.buildingId === r.buildingId);
                    return (
                      <tr key={r.roomId} className="hover:bg-[#F7F7F7]">
                        <td className="py-2.5 pr-2">
                          <span className="font-mono font-bold text-[#2A3F54]">{r.roomCode}</span>
                          <div className="text-[#5A738E]">{r.roomName}</div>
                        </td>
                        <td className="py-2.5 px-2 font-mono text-[11px] text-[#2A3F54]">
                          {bld?.buildingCode ?? '—'} · Tầng {r.floorNumber}
                        </td>
                        <td className="py-2.5 px-2 text-[#5A738E]">{ROOM_TYPE_LABELS[r.roomType]}</td>
                        <td className="py-2.5 px-2 font-mono font-bold text-[#2A3F54]">{r.maxCapacity} chỗ</td>
                        <td className="py-2.5 px-2">
                          <span
                            className={`font-semibold ${
                              r.operationalStatus === 'AVAILABLE'
                                ? 'text-[#169F85]'
                                : r.operationalStatus === 'MAINTENANCE'
                                ? 'text-[#F39C12]'
                                : 'text-[#E74C3C]'
                            }`}
                          >
                            {r.operationalStatus === 'AVAILABLE'
                              ? 'Sẵn sàng'
                              : r.operationalStatus === 'MAINTENANCE'
                              ? 'Bảo trì'
                              : 'Khóa'}
                          </span>
                        </td>
                        <td className="py-2.5 pl-2 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {canUpdateRoom && (
                              <button
                                type="button"
                                onClick={() => startEditRoom(r)}
                                className="px-2 py-1 rounded border border-[#3498DB] text-[#3498DB] hover:bg-[#EFF6FF] font-semibold inline-flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" /> Sửa
                              </button>
                            )}
                            {canDeleteRoom &&
                              (confirmDeleteId === r.roomId ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await deleteClassroom(r.roomId);
                                      setConfirmDeleteId(null);
                                    }}
                                    className="px-2 py-1 rounded bg-[#E74C3C] text-white font-semibold"
                                  >
                                    Xác nhận
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="p-1 text-[#73879C]"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(r.roomId)}
                                  className="px-2 py-1 rounded border border-[#FCA5A5] text-[#B91C1C] hover:bg-[#FEF2F2] font-semibold inline-flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" /> Xóa
                                </button>
                              ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="x_panel xl:col-span-4">
            <div className="x_title flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#2A3F54] flex items-center gap-1.5">
                {editingRoomId ? <Edit3 className="w-4 h-4 text-[#3498DB]" /> : <Plus className="w-4 h-4 text-[#1ABB9C]" />}
                {editingRoomId ? 'Chỉnh sửa Phòng học' : 'Thêm mới Phòng học'}
              </h3>
              {editingRoomId && (
                <button type="button" onClick={resetRoomForm} className="text-xs text-[#73879C] underline">
                  Hủy sửa
                </button>
              )}
            </div>
            <form onSubmit={submitRoom} className="x_content space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">Mã Phòng *</label>
                  <input
                    required
                    value={rmCode}
                    onChange={(e) => setRmCode(e.target.value)}
                    placeholder="VD: A1-401"
                    className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">Tòa nhà *</label>
                  <select
                    value={rmBuildingId}
                    onChange={(e) => setRmBuildingId(e.target.value)}
                    className="w-full border border-[#D9DEE4] rounded px-2 py-1.5 bg-white"
                  >
                    {state.buildings.map((b) => (
                      <option key={b.buildingId} value={b.buildingId}>
                        {b.buildingCode} — {b.buildingName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Tên Phòng học *</label>
                <input
                  required
                  value={rmName}
                  onChange={(e) => setRmName(e.target.value)}
                  placeholder="VD: Giảng đường Thông minh A1-401"
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Loại phòng chuyên dụng</label>
                <select
                  value={rmType}
                  onChange={(e) => setRmType(e.target.value as RoomType)}
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 bg-white"
                >
                  {ALL_ROOM_TYPES.map((rt) => (
                    <option key={rt} value={rt}>
                      {ROOM_TYPE_LABELS[rt]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">Sức chứa</label>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={rmCapacity}
                    onChange={(e) => setRmCapacity(Number(e.target.value))}
                    className="w-full border border-[#D9DEE4] rounded px-2 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">Tầng</label>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={rmFloor}
                    onChange={(e) => setRmFloor(Number(e.target.value))}
                    className="w-full border border-[#D9DEE4] rounded px-2 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">Trạng thái</label>
                  <select
                    value={rmStatus}
                    onChange={(e) => setRmStatus(e.target.value as RoomStatus)}
                    className="w-full border border-[#D9DEE4] rounded px-1.5 py-1.5 bg-white"
                  >
                    <option value="AVAILABLE">Sẵn sàng</option>
                    <option value="MAINTENANCE">Bảo trì</option>
                    <option value="LOCKED">Khóa</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={editingRoomId ? !canUpdateRoom : !canCreateRoom}
                className="w-full py-2 rounded bg-[#1ABB9C] hover:bg-[#169F85] disabled:opacity-40 text-white font-semibold"
              >
                {editingRoomId ? 'Lưu cập nhật Phòng học' : 'Thêm mới Phòng học'}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* 4. EXAM MODELS CRUD */}
      {subTab === 'EXAM_MODELS' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <section className="x_panel xl:col-span-8">
            <div className="x_title flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-bold text-[#2A3F54]">
                  Danh mục Mô hình Thi & Quy chuẩn Khảo thí ({filteredExamModels.length})
                </h2>
                <p className="text-xs text-[#73879C] mt-0.5">
                  Đồng bộ trực tiếp với cấu hình Học phần và phân hệ Tổ chức Lịch thi (Tỷ lệ giãn cách ghế & Giám thị)
                </p>
              </div>
              <ExportToolbar
                compact
                filenameBase="UTS_Master_MoHinhThi"
                reportTitle="Danh mục Master Data Mô hình Thi Đại học"
                columns={[
                  { header: 'Mã Mô hình', accessor: (m) => m.code },
                  { header: 'Tên Mô hình thi', accessor: (m) => m.name },
                  { header: 'Nhóm kỳ thi', accessor: (m) => (m.baseMode === 'MODULAR' ? 'Cuốn chiếu' : 'Tập trung') },
                  { header: 'Thời lượng (phút)', accessor: (m) => m.durationMinutes },
                  { header: 'Số tiết/ca', accessor: (m) => m.periodsRequired },
                  { header: 'Định mức SV/Giám thị', accessor: (m) => m.studentsPerProctor },
                  { header: 'Trần lấp đầy phòng (%)', accessor: (m) => `${m.maxRoomFillPercent}%` },
                  { header: 'Loại phòng phù hợp', accessor: (m) => formatRoomTypesList(m.allowedRoomTypes) },
                ]}
                rows={filteredExamModels}
              />
            </div>

            <div className="x_content overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b-2 border-[#E6E9ED] text-[#5A738E] text-left">
                    <th className="py-2 pr-2 font-semibold">Mã & Tên Mô hình thi</th>
                    <th className="py-2 px-2 font-semibold">Thời lượng / Nhóm</th>
                    <th className="py-2 px-2 font-semibold">Quy chuẩn Giám thị & Ghế</th>
                    <th className="py-2 px-2 font-semibold">Loại phòng thi</th>
                    <th className="py-2 pl-2 text-right font-semibold">Thao tác CRUD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E9ED]">
                  {filteredExamModels.map((m) => (
                    <tr key={m.modelId} className="hover:bg-[#F7F7F7]">
                      <td className="py-2.5 pr-2">
                        <span className="font-mono font-bold text-[#2A3F54]">{m.code}</span>
                        <div className="font-semibold text-[#2A3F54]">{m.name}</div>
                        <div className="text-[11px] text-[#73879C] mt-0.5 max-w-[260px]">{m.description}</div>
                      </td>
                      <td className="py-2.5 px-2 font-mono">
                        <div>{m.durationMinutes} phút ({m.periodsRequired} tiết)</div>
                        <div className="text-[11px] text-[#169F85] font-sans font-semibold mt-0.5">
                          {m.baseMode === 'MODULAR' ? 'Thi Cuốn chiếu' : 'Thi Tập trung'}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 font-mono text-[11px] text-[#2A3F54]">
                        <div>1 GT / {m.studentsPerProctor} SV</div>
                        <div className="text-[#5A738E]">Trần ghế: {m.maxRoomFillPercent}%</div>
                      </td>
                      <td className="py-2.5 px-2 text-[11px] text-[#5A738E]">
                        {formatRoomTypesList(m.allowedRoomTypes)}
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {canUpdateEM && (
                            <button
                              type="button"
                              onClick={() => startEditExamModel(m)}
                              className="px-2 py-1 rounded border border-[#3498DB] text-[#3498DB] hover:bg-[#EFF6FF] font-semibold inline-flex items-center gap-1"
                            >
                              <Edit3 className="w-3 h-3" /> Sửa
                            </button>
                          )}
                          {canDeleteEM &&
                            (confirmDeleteId === m.modelId ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await deleteExamModel(m.modelId);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2 py-1 rounded bg-[#E74C3C] text-white font-semibold"
                                >
                                  Xác nhận
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="p-1 text-[#73879C]"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(m.modelId)}
                                className="px-2 py-1 rounded border border-[#FCA5A5] text-[#B91C1C] hover:bg-[#FEF2F2] font-semibold inline-flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" /> Xóa
                              </button>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="x_panel xl:col-span-4">
            <div className="x_title flex items-center justify-between">
              <h3 className="text-[14px] font-bold text-[#2A3F54] flex items-center gap-1.5">
                {editingExamModelId ? <Edit3 className="w-4 h-4 text-[#3498DB]" /> : <Plus className="w-4 h-4 text-[#1ABB9C]" />}
                {editingExamModelId ? 'Chỉnh sửa Mô hình thi' : 'Thêm mới Mô hình thi'}
              </h3>
              {editingExamModelId && (
                <button type="button" onClick={resetExamModelForm} className="text-xs text-[#73879C] underline">
                  Hủy sửa
                </button>
              )}
            </div>
            <form onSubmit={submitExamModel} className="x_content space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">Mã Mô hình *</label>
                  <input
                    required
                    value={emCode}
                    onChange={(e) => setEmCode(e.target.value)}
                    placeholder="VD: EXM_ORAL"
                    className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">Nhóm tổ chức</label>
                  <select
                    value={emBaseMode}
                    onChange={(e) => setEmBaseMode(e.target.value as 'MODULAR' | 'CONSOLIDATED')}
                    className="w-full border border-[#D9DEE4] rounded px-2 py-1.5 bg-white"
                  >
                    <option value="MODULAR">Cuốn chiếu (MODULAR)</option>
                    <option value="CONSOLIDATED">Tập trung (CONSOLIDATED)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Tên Mô hình thi *</label>
                <input
                  required
                  value={emName}
                  onChange={(e) => setEmName(e.target.value)}
                  placeholder="VD: Thi Trắc nghiệm Online tại Phòng máy"
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">Thời lượng (phút)</label>
                  <input
                    type="number"
                    min={30}
                    max={240}
                    value={emDuration}
                    onChange={(e) => setEmDuration(Number(e.target.value))}
                    className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">Số tiết chiếm phòng</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={emPeriods}
                    onChange={(e) => setEmPeriods(Number(e.target.value))}
                    className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">Định mức SV / 1 GT</label>
                  <input
                    type="number"
                    min={10}
                    max={60}
                    value={emProctorRatio}
                    onChange={(e) => setEmProctorRatio(Number(e.target.value))}
                    className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2A3F54] mb-1">Trần lấp đầy ghế (%)</label>
                  <input
                    type="number"
                    min={25}
                    max={100}
                    value={emFillPercent}
                    onChange={(e) => setEmFillPercent(Number(e.target.value))}
                    className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5 font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Loại phòng thi cho phép (chọn nhiều)</label>
                <div className="grid grid-cols-2 gap-1.5 p-2 bg-[#FAFAFA] border border-[#E6E9ED] rounded">
                  {ALL_ROOM_TYPES.map((rt) => (
                    <label key={rt} className="flex items-center gap-1.5 cursor-pointer text-[11px] text-[#2A3F54]">
                      <input
                        type="checkbox"
                        checked={emRoomTypes.includes(rt)}
                        onChange={() => toggleEmRoomType(rt)}
                      />
                      <span>{ROOM_TYPE_LABELS[rt]}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block font-semibold text-[#2A3F54] mb-1">Mô tả quy chế</label>
                <textarea
                  rows={2}
                  value={emDescription}
                  onChange={(e) => setEmDescription(e.target.value)}
                  placeholder="Quy định ngồi cách bàn, số giám thị, thiết bị..."
                  className="w-full border border-[#D9DEE4] rounded px-2.5 py-1.5"
                />
              </div>
              <button
                type="submit"
                disabled={editingExamModelId ? !canUpdateEM : !canCreateEM}
                className="w-full py-2 rounded bg-[#1ABB9C] hover:bg-[#169F85] disabled:opacity-40 text-white font-semibold"
              >
                {editingExamModelId ? 'Lưu cập nhật Mô hình thi' : 'Thêm mới Mô hình thi'}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};
