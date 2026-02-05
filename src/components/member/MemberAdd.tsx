import { useState } from "react";
import type { FormEvent } from "react";
import { useSquadStore } from "@/stores/squadStore";
import { Button, Input } from "@/components/ui";
import type { IMember } from "@/types";

export const MemberAdd = () => {
  const [name, setName] = useState("");
  const addMember = useSquadStore((state) => state.addMember);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("이름을 입력해주세요");
      return;
    }

    const newMember: IMember = {
      id: Date.now().toString(),
      name: name.trim(),
      active: true,
      createdAt: new Date().toISOString(),
    };

    addMember(newMember);
    setName("");
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        type="text"
        placeholder="멤버 이름"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1"
      />
      <Button type="submit" className="shrink-0">
        추가
      </Button>
    </form>
  );
};
