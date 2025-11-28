// Função para gerar payload PIX no formato EMV
export function generatePixPayload(
  pixKey: string,
  recipientName: string,
  city: string,
  amount: number,
  transactionId?: string
): string {
  // IDs dos campos conforme especificação EMV
  const PAYLOAD_FORMAT_INDICATOR = '01';
  const MERCHANT_ACCOUNT_INFORMATION = '26';
  const MERCHANT_ACCOUNT_INFORMATION_GUI = '00';
  const MERCHANT_ACCOUNT_INFORMATION_KEY = '01';
  const MERCHANT_CATEGORY_CODE = '52';
  const TRANSACTION_CURRENCY = '53';
  const TRANSACTION_AMOUNT = '54';
  const COUNTRY_CODE = '58';
  const MERCHANT_NAME = '59';
  const MERCHANT_CITY = '60';
  const ADDITIONAL_DATA_FIELD_TEMPLATE = '62';
  const ADDITIONAL_DATA_FIELD_TEMPLATE_TXID = '05';
  const CRC16 = '63';

  // Função auxiliar para criar um campo EMV
  function createEMVField(id: string, value: string): string {
    const length = value.length.toString().padStart(2, '0');
    return `${id}${length}${value}`;
  }

  // Merchant Account Information (campo 26)
  const merchantAccountInfo = createEMVField(
    MERCHANT_ACCOUNT_INFORMATION_GUI,
    'br.gov.bcb.pix'
  ) + createEMVField(MERCHANT_ACCOUNT_INFORMATION_KEY, pixKey);

  const merchantAccountInfoField = createEMVField(
    MERCHANT_ACCOUNT_INFORMATION,
    merchantAccountInfo
  );

  // Campos obrigatórios
  let payload = '';
  payload += createEMVField(PAYLOAD_FORMAT_INDICATOR, '01');
  payload += merchantAccountInfoField;
  payload += createEMVField(MERCHANT_CATEGORY_CODE, '0000');
  payload += createEMVField(TRANSACTION_CURRENCY, '986'); // BRL
  payload += createEMVField(TRANSACTION_AMOUNT, amount.toFixed(2));
  payload += createEMVField(COUNTRY_CODE, 'BR');
  payload += createEMVField(MERCHANT_NAME, recipientName.substring(0, 25));
  payload += createEMVField(MERCHANT_CITY, city.substring(0, 15));

  // Campo adicional com ID da transação (opcional)
  if (transactionId) {
    const additionalDataField = createEMVField(
      ADDITIONAL_DATA_FIELD_TEMPLATE_TXID,
      transactionId.substring(0, 25)
    );
    payload += createEMVField(ADDITIONAL_DATA_FIELD_TEMPLATE, additionalDataField);
  }

  // Adicionar placeholder para CRC16
  payload += CRC16 + '04';

  // Calcular CRC16
  const crc = calculateCRC16(payload);
  payload += crc;

  return payload;
}

// Implementação do algoritmo CRC16-CCITT
function calculateCRC16(payload: string): string {
  const polynomial = 0x1021;
  let crc = 0xFFFF;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;

    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}
