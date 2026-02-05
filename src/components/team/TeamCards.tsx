import { Swiper, SwiperSlide } from "swiper/react";
import { EffectCards } from "swiper/modules";
import type { IMember } from "@/types";

// @ts-expect-error - CSS import
import "swiper/css";
// @ts-expect-error - CSS import
import "swiper/css/effect-cards";

interface ITeamCardsProps {
  teams: IMember[][];
}

export const TeamCards = ({ teams }: ITeamCardsProps) => {
  const teamColors = [
    "border-[#ff6b6b] bg-[#ff6b6b]/10",
    "border-[#4facfe] bg-[#4facfe]/10",
    "border-[#43e97b] bg-[#43e97b]/10",
    "border-[#fa709a] bg-[#fa709a]/10",
    "border-[#a8edea] bg-[#a8edea]/10",
  ];

  const teamNames = ["A", "B", "C", "D", "E"];

  if (teams.length === 0) {
    return null;
  }

  return (
    <div className="flex justify-center py-8">
      <Swiper
        effect="cards"
        grabCursor={true}
        modules={[EffectCards]}
        className="w-[280px] md:w-[300px]"
      >
        {teams.map((team, index) => (
          <SwiperSlide key={index}>
            <div
              className={`flex h-[420px] md:h-[450px] flex-col rounded-2xl border-2 p-6 ${teamColors[index]}`}
            >
              <div className="mb-4 text-center">
                <h3 className="text-3xl font-bold text-white">
                  {teamNames[index]}팀
                </h3>
                <p className="mt-2 text-sm text-gray-400">
                  {team.length}명
                </p>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto">
                {team.map((member, memberIndex) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 rounded-lg bg-black/20 p-3"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm font-bold">
                      {memberIndex + 1}
                    </span>
                    <span className="text-lg text-white">{member.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};
