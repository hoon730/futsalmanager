import { AttendanceStats, DivisionHistory } from "@/components/attendance";

const AttendancePage = () => {
  return (
    <div className="space-y-6">
      <AttendanceStats />
      <DivisionHistory />
    </div>
  );
};

export default AttendancePage;
