interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// 카카오 OPEN_MAP_AND_LOCAL 서비스 심사 완료 전까지 단순 텍스트 입력으로 운영.
// 사용자는 카카오맵에서 주소를 복사해 붙여넣거나 자유 텍스트로 입력.
// 경기 상세에서 "카카오맵/네이버지도에서 보기" 버튼으로 위치 확인 가능.
export default function PlaceSearchInput({
  value,
  onChange,
  placeholder = "풋살장 이름 또는 주소",
}: Props) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-primary/50 transition-all"
    />
  );
}
