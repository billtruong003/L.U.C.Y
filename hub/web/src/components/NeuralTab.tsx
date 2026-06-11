import Galaxy from './Galaxy'

// Tab Neural = VŨ TRỤ LUCY (1 scene gộp): dải ngân hà tri thức (storage — hành tinh = note thật
// neo trên cánh tay xoắn ốc) + lõi L.U.C.Y + node live quay quanh lõi (telemetry real-time).
// (BrainViz cũ vẫn còn ở /preview cho dev; toggle Live/Galaxy bỏ — 2 thế giới đã là 1.)
export default function NeuralTab({ visible }: { visible: boolean }) {
  return <Galaxy visible={visible} />
}
