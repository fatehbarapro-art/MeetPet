import { useMeetingStore } from '../../store.ts'
import Header from './Header.tsx'
import SpeakerBars from './SpeakerBars.tsx'
import ActionsList from './ActionsList.tsx'
import Transcript from './Transcript.tsx'
import BottomBar from './BottomBar.tsx'
import BlopCanvas from '../Blop/BlopCanvas.tsx'
import BlopStats from '../Blop/BlopStats.tsx'
import BlopSpeech from '../Blop/BlopSpeech.tsx'

export default function MeetingRoom() {
  const { title, blopState, blopSpeech } = useMeetingStore()

  return (
    <div className="flex flex-col h-screen">
      <Header title={title} />

      <div className="flex flex-1 overflow-hidden">
        {/* Colonne gauche */}
        <div className="w-64 flex flex-col border-r border-slate-800 p-4 gap-4">
          <SpeakerBars />
          <ActionsList />
        </div>

        {/* Colonne centre — Blop */}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <div className="relative">
            <BlopCanvas state={blopState} />
            {blopSpeech && <BlopSpeech text={blopSpeech} />}
          </div>
          <BlopStats state={blopState} />
        </div>

        {/* Colonne droite — Transcript */}
        <div className="w-96 border-l border-slate-800">
          <Transcript />
        </div>
      </div>

      <BottomBar />
    </div>
  )
}
