import { useEffect, useState } from 'react';
import { Clock, Play, Flag, Hourglass } from 'lucide-react';

interface Props {
  iniciadoAt?: string | null;
  finalizadoAt?: string | null;
  total: number;
  processados: number;
  delayMedioSegundos?: number; // padrão: 10s (média entre delay_min/max default 5..15)
  ativo: boolean;
}

function formatHora(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '--:--';
  }
}

function formatDuracao(segundos: number) {
  if (segundos < 0) segundos = 0;
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

export function DisparoTimer({
  iniciadoAt,
  finalizadoAt,
  total,
  processados,
  delayMedioSegundos = 10,
  ativo,
}: Props) {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (!ativo) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ativo]);

  const restantes = Math.max(0, total - processados);
  const inicioMs = iniciadoAt ? new Date(iniciadoAt).getTime() : null;
  const fimMs = finalizadoAt ? new Date(finalizadoAt).getTime() : null;

  // Estimativa adaptativa: se já temos histórico, calcula tempo médio real por envio.
  // Senão usa o delay médio configurado.
  let segundosPorEnvio = delayMedioSegundos;
  if (inicioMs && processados > 0 && ativo) {
    const decorrido = (agora - inicioMs) / 1000;
    const medido = decorrido / processados;
    if (medido > 0 && medido < 600) segundosPorEnvio = medido;
  }

  const segundosRestantes = Math.round(restantes * segundosPorEnvio);
  const previsaoFimMs = ativo && inicioMs ? agora + segundosRestantes * 1000 : null;
  const duracaoTotalSeg = inicioMs && fimMs ? Math.round((fimMs - inicioMs) / 1000) : null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground pt-1">
      {iniciadoAt && (
        <span className="inline-flex items-center gap-1">
          <Play className="h-3 w-3 text-emerald-600" />
          Início: <span className="font-medium text-foreground">{formatHora(iniciadoAt)}</span>
        </span>
      )}

      {ativo && restantes > 0 && (
        <span className="inline-flex items-center gap-1">
          <Hourglass className="h-3 w-3 text-amber-600 animate-pulse" />
          Restante: <span className="font-medium text-foreground tabular-nums">{formatDuracao(segundosRestantes)}</span>
        </span>
      )}

      {ativo && previsaoFimMs && restantes > 0 && (
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3 text-primary" />
          Previsão: <span className="font-medium text-foreground">{formatHora(new Date(previsaoFimMs).toISOString())}</span>
        </span>
      )}

      {finalizadoAt && (
        <span className="inline-flex items-center gap-1">
          <Flag className="h-3 w-3 text-emerald-700" />
          Fim: <span className="font-medium text-foreground">{formatHora(finalizadoAt)}</span>
        </span>
      )}

      {duracaoTotalSeg !== null && (
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Duração: <span className="font-medium text-foreground">{formatDuracao(duracaoTotalSeg)}</span>
        </span>
      )}
    </div>
  );
}
