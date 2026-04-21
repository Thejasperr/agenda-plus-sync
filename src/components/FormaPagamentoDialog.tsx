import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { QrCode, Copy, Download, Printer, Share2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generatePixPayload } from '@/lib/pixQrCode';
import { QRCodeSVG } from 'qrcode.react';

interface FormaPagamento {
  id: string;
  nome: string;
  ativa: boolean;
  qr_code_pix: string | null;
}

interface FormaPagamentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (formaPagamento: string) => void;
  agendamentoId: string;
  valorServico: number;
  clienteTelefone: string;
}

const FormaPagamentoDialog: React.FC<FormaPagamentoDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  agendamentoId,
  valorServico,
  clienteTelefone
}) => {
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [formaSelecionada, setFormaSelecionada] = useState('');
  const [valorPago, setValorPago] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [pixPayload, setPixPayload] = useState<string>('');
  const [loadingPix, setLoadingPix] = useState(false);
  const qrCodeContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchFormasPagamento();
      setValorPago(valorServico.toFixed(2));
    }
  }, [open, valorServico]);

  // Regenerar QR Code quando o valor pago mudar
  useEffect(() => {
    if (open && valorPago) {
      generatePixQrCode(parseFloat(valorPago));
    }
  }, [open, valorPago]);

  const generatePixQrCode = async (valor: number) => {
    if (isNaN(valor) || valor <= 0) {
      setPixPayload('');
      return;
    }

    setLoadingPix(true);
    try {
      const { data: configPix, error } = await supabase
        .from('configuracoes_pix')
        .select('*')
        .limit(1)
        .maybeSingle();

      console.log('Configuração PIX:', configPix, 'Erro:', error);

      if (configPix) {
        const payload = generatePixPayload(
          configPix.chave_pix,
          configPix.nome_recebedor,
          configPix.cidade,
          valor,
          agendamentoId.substring(0, 25)
        );
        console.log('Payload PIX gerado:', payload);
        setPixPayload(payload);
      } else {
        console.log('Nenhuma configuração PIX encontrada');
      }
    } catch (error) {
      console.error('Erro ao gerar QR Code PIX:', error);
    } finally {
      setLoadingPix(false);
    }
  };

  const fetchFormasPagamento = async () => {
    try {
      const { data, error } = await supabase
        .from('formas_pagamento')
        .select('*')
        .eq('ativa', true)
        .order('nome');

      if (error) throw error;
      setFormasPagamento((data as FormaPagamento[]) || []);
    } catch (error) {
      console.error('Erro ao buscar formas de pagamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as formas de pagamento",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadQRCode = () => {
    const svgElement = qrCodeContainerRef.current?.querySelector('svg');
    if (!svgElement) return;

    try {
      // Criar um canvas para converter o SVG em PNG
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const img = new Image();
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            const link = document.createElement('a');
            link.download = `qrcode-pix-${agendamentoId.substring(0, 8)}.png`;
            link.href = URL.createObjectURL(blob);
            link.click();
            
            toast({
              title: "Download iniciado",
              description: "QR Code salvo como imagem PNG",
            });
          }
        }, 'image/png');

        URL.revokeObjectURL(url);
      };

      img.src = url;
    } catch (error) {
      console.error('Erro ao baixar QR Code:', error);
      toast({
        title: "Erro",
        description: "Não foi possível baixar o QR Code",
        variant: "destructive",
      });
    }
  };

  const handlePrintQRCode = () => {
    const svgElement = qrCodeContainerRef.current?.querySelector('svg');
    if (!svgElement) return;

    try {
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const printWindow = window.open('', '_blank');
      
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>QR Code PIX - R$ ${parseFloat(valorPago).toFixed(2)}</title>
              <style>
                body {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  margin: 0;
                  font-family: Arial, sans-serif;
                  padding: 20px;
                }
                .container {
                  text-align: center;
                }
                h1 {
                  font-size: 24px;
                  margin-bottom: 10px;
                }
                .amount {
                  font-size: 32px;
                  font-weight: bold;
                  color: #00875F;
                  margin: 10px 0;
                }
                .qr-code {
                  margin: 20px 0;
                }
                .code-container {
                  margin-top: 20px;
                  padding: 15px;
                  background: #f5f5f5;
                  border-radius: 8px;
                  max-width: 500px;
                  word-break: break-all;
                  font-family: monospace;
                  font-size: 12px;
                }
                @media print {
                  body {
                    padding: 0;
                  }
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Pagamento PIX</h1>
                <div class="amount">R$ ${parseFloat(valorPago).toFixed(2)}</div>
                <div class="qr-code">
                  ${svgData}
                </div>
                <p><strong>Escaneie o QR Code acima ou copie o código abaixo:</strong></p>
                <div class="code-container">
                  ${pixPayload}
                </div>
              </div>
            </body>
          </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
        
        setTimeout(() => {
          printWindow.print();
        }, 250);

        toast({
          title: "Impressão iniciada",
          description: "Janela de impressão aberta",
        });
      }
    } catch (error) {
      console.error('Erro ao imprimir QR Code:', error);
      toast({
        title: "Erro",
        description: "Não foi possível imprimir o QR Code",
        variant: "destructive",
      });
    }
  };

  const handleShareWhatsApp = async () => {
    const valor = parseFloat(valorPago).toFixed(2);
    const message = `💰 *Pagamento PIX*\n\n` +
      `Valor: *R$ ${valor}*\n\n` +
      `📱 *Código PIX Copia e Cola:*\n${pixPayload}\n\n` +
      `Copie o código acima e cole no seu aplicativo de banco para realizar o pagamento.`;
    
    // Formatar telefone do cliente
    const telefoneFormatado = clienteTelefone.replace(/\D/g, '');
    const telefoneCompleto = telefoneFormatado.startsWith('55') ? telefoneFormatado : `55${telefoneFormatado}`;
    const whatsappUrl = `https://wa.me/${telefoneCompleto}?text=${encodeURIComponent(message)}`;
    
    // Copiar mensagem primeiro
    try {
      await navigator.clipboard.writeText(message);
    } catch (e) {
      console.log('Erro ao copiar:', e);
    }
    
    // Tentar abrir WhatsApp de diferentes formas
    try {
      // Método 1: window.open
      const win = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      
      if (!win || win.closed || typeof win.closed === 'undefined') {
        // Método 2: location.assign em nova janela falhou, tentar link
        const link = document.createElement('a');
        link.href = whatsappUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (e) {
      console.log('Erro ao abrir WhatsApp:', e);
    }
    
    toast({
      title: "Mensagem copiada!",
      description: `Abra o WhatsApp do cliente (${clienteTelefone}) e cole a mensagem`,
    });
  };

  const sendWhatsAppPaymentSummary = async (
    valorPagoNum: number,
    diferenca: number,
    forma: string,
  ) => {
    if (!clienteTelefone) return;
    try {
      // Buscar chat correspondente
      const digits = clienteTelefone.replace(/\D/g, '');
      const { data: chats } = await supabase
        .from('whatsapp_chats')
        .select('id, remote_jid')
        .or(`telefone.eq.${clienteTelefone},telefone.eq.${digits},telefone.ilike.%${digits.slice(-8)}%`)
        .limit(1);
      const chat = chats?.[0];
      if (!chat) return;

      let mensagem = `✅ *Pagamento confirmado*\n\n` +
        `Serviço: R$ ${valorServico.toFixed(2)}\n` +
        `Pago: R$ ${valorPagoNum.toFixed(2)}\n` +
        `Forma: ${forma}`;

      if (diferenca > 0) {
        mensagem += `\n\n💰 Você pagou *R$ ${diferenca.toFixed(2)} a mais*. Esse valor foi adicionado como crédito para o próximo atendimento.`;
      } else if (diferenca < 0) {
        mensagem += `\n\n⚠️ Faltou *R$ ${Math.abs(diferenca).toFixed(2)}* para completar o pagamento. Esse valor ficou registrado como pendência.`;
      } else {
        mensagem += `\n\nObrigado! 🙌`;
      }

      await supabase.functions.invoke('whatsapp-send', {
        body: {
          chat_id: chat.id,
          remote_jid: chat.remote_jid,
          type: 'text',
          content: mensagem,
        },
      });
    } catch (e) {
      console.error('Erro ao enviar resumo no WhatsApp:', e);
    }
  };

  const handleConfirm = async () => {
    if (!formaSelecionada) {
      toast({
        title: "Erro",
        description: "Selecione uma forma de pagamento",
        variant: "destructive",
      });
      return;
    }

    const valorPagoNum = parseFloat(valorPago);
    if (isNaN(valorPagoNum) || valorPagoNum < 0) {
      toast({
        title: "Erro",
        description: "Valor pago inválido",
        variant: "destructive",
      });
      return;
    }

    try {
      // Diferença: positivo = pagou a mais (crédito), negativo = pagou a menos (dívida)
      const diferenca = valorPagoNum - valorServico;

      // Atualizar saldo do cliente quando houver diferença
      if (diferenca !== 0 && clienteTelefone) {
        const { data: clienteData } = await supabase
          .from('clientes')
          .select('saldo_credito')
          .eq('telefone', clienteTelefone)
          .maybeSingle();

        if (clienteData) {
          const novoSaldo = (Number(clienteData.saldo_credito) || 0) + diferenca;
          await supabase
            .from('clientes')
            .update({ saldo_credito: novoSaldo })
            .eq('telefone', clienteTelefone);

          if (diferenca > 0) {
            toast({
              title: "Crédito adicionado",
              description: `R$ ${diferenca.toFixed(2)} foi adicionado ao saldo do cliente`,
            });
          } else {
            toast({
              title: "Pendência registrada",
              description: `Cliente ficou devendo R$ ${Math.abs(diferenca).toFixed(2)}`,
              variant: "destructive",
            });
          }
        }
      }

      // Atualizar agendamento com status concluído e forma de pagamento
      const { error } = await supabase
        .from('agendamentos')
        .update({ 
          status: 'Concluído',
          forma_pagamento: formaSelecionada 
        })
        .eq('id', agendamentoId);

      if (error) throw error;

      // Enviar resumo no WhatsApp (não bloqueia)
      sendWhatsAppPaymentSummary(valorPagoNum, diferenca, formaSelecionada);

      onConfirm(formaSelecionada);
      setFormaSelecionada('');
      setValorPago('');
    } catch (error) {
      console.error('Erro ao salvar forma de pagamento:', error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar a forma de pagamento",
        variant: "destructive",
      });
    }
  };

  const formaSelecionadaObj = formasPagamento.find(f => f.nome === formaSelecionada);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90%] max-w-md mx-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Forma de Pagamento</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label>Valor do serviço</Label>
            <div className="text-2xl font-bold text-primary">
              R$ {valorServico.toFixed(2)}
            </div>
          </div>

          <div>
            <Label htmlFor="valor_pago">Valor pago pelo cliente *</Label>
            <Input
              id="valor_pago"
              type="number"
              step="0.01"
              min="0"
              value={valorPago}
              onChange={(e) => setValorPago(e.target.value)}
              placeholder="0.00"
            />
            {parseFloat(valorPago) > valorServico && (
              <p className="text-sm text-green-600 mt-1">
                Crédito de R$ {(parseFloat(valorPago) - valorServico).toFixed(2)} será adicionado ao cliente
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="forma_pagamento">Selecione a forma de pagamento *</Label>
            <Select value={formaSelecionada} onValueChange={setFormaSelecionada}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha uma forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                {formasPagamento.map((forma) => (
                  <SelectItem key={forma.id} value={forma.nome}>
                    {forma.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Loading indicator while generating PIX */}
          {formaSelecionada?.toLowerCase().includes('pix') && loadingPix && (
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col items-center justify-center py-8 space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Gerando QR Code PIX...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mostrar QR Code PIX dinâmico se PIX for selecionado */}
          {formaSelecionada?.toLowerCase().includes('pix') && !loadingPix && pixPayload && (
            <Card>
              <CardContent className="p-4">
                <div className="text-center space-y-3">
                  <div className="text-sm font-medium">QR Code PIX</div>
                  
                  {/* QR Code visual escaneável */}
                  <div 
                    ref={qrCodeContainerRef}
                    className="flex justify-center p-4 bg-white rounded-lg"
                  >
                    <QRCodeSVG 
                      value={pixPayload} 
                      size={200}
                      level="M"
                      includeMargin={true}
                    />
                  </div>
                  
                  {/* Botões de ação para QR Code */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadQRCode}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Baixar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePrintQRCode}
                      className="flex-1"
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimir
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleShareWhatsApp}
                      className="flex-1"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                  </div>
                  
                  <div className="text-xs text-muted-foreground font-medium">
                    Escaneie o QR Code acima ou copie o código abaixo
                  </div>
                  
                  {/* Código Copia e Cola */}
                  <div className="bg-muted p-3 rounded-lg text-xs font-mono break-all max-h-32 overflow-y-auto">
                    {pixPayload}
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(pixPayload);
                      toast({
                        title: "Copiado!",
                        description: "Código PIX copiado para a área de transferência",
                      });
                    }}
                    className="w-full"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Código PIX
                  </Button>
                  
                  <div className="text-xs text-muted-foreground">
                    Valor: R$ {parseFloat(valorPago).toFixed(2)}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Mostrar QR Code estático (legado) se disponível */}
          {formaSelecionadaObj?.qr_code_pix && !pixPayload && (
            <Card>
              <CardContent className="p-4">
                <div className="text-center space-y-2">
                  <QrCode className="h-8 w-8 mx-auto text-primary" />
                  <div className="text-sm font-medium">QR Code PIX</div>
                  <div className="bg-muted p-3 rounded text-xs font-mono break-all">
                    {formaSelecionadaObj.qr_code_pix}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Copie o código acima ou escaneie o QR Code
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setFormaSelecionada('');
                onOpenChange(false);
              }} 
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirm} 
              className="flex-1"
              disabled={!formaSelecionada}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FormaPagamentoDialog;