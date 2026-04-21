export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      agendamento_procedimentos: {
        Row: {
          agendamento_id: string
          created_at: string
          id: string
          ordem: number
          procedimento_id: string
          user_id: string | null
        }
        Insert: {
          agendamento_id: string
          created_at?: string
          id?: string
          ordem?: number
          procedimento_id: string
          user_id?: string | null
        }
        Update: {
          agendamento_id?: string
          created_at?: string
          id?: string
          ordem?: number
          procedimento_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamento_procedimentos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamento_procedimentos_procedimento_id_fkey"
            columns: ["procedimento_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamentos: {
        Row: {
          confirm_atendi: boolean | null
          created_at: string
          data_agendamento: string
          data_retorno: string | null
          "event.id": string | null
          forma_pagamento: string | null
          hora_agendamento: string
          id: string
          mensagem_av_google: boolean | null
          mensagem_enviada: boolean | null
          nome: string
          observacoes: string | null
          pagamento_antecipado: boolean | null
          porcentagem_desconto: number | null
          porcentagem_pagamento_antecipado: number | null
          preco: number
          preco_retorno: number | null
          procedimento_id: string | null
          status: string
          telefone: string
          tem_desconto: boolean | null
          tem_retorno: boolean | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          confirm_atendi?: boolean | null
          created_at?: string
          data_agendamento: string
          data_retorno?: string | null
          "event.id"?: string | null
          forma_pagamento?: string | null
          hora_agendamento: string
          id?: string
          mensagem_av_google?: boolean | null
          mensagem_enviada?: boolean | null
          nome: string
          observacoes?: string | null
          pagamento_antecipado?: boolean | null
          porcentagem_desconto?: number | null
          porcentagem_pagamento_antecipado?: number | null
          preco: number
          preco_retorno?: number | null
          procedimento_id?: string | null
          status?: string
          telefone: string
          tem_desconto?: boolean | null
          tem_retorno?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          confirm_atendi?: boolean | null
          created_at?: string
          data_agendamento?: string
          data_retorno?: string | null
          "event.id"?: string | null
          forma_pagamento?: string | null
          hora_agendamento?: string
          id?: string
          mensagem_av_google?: boolean | null
          mensagem_enviada?: boolean | null
          nome?: string
          observacoes?: string | null
          pagamento_antecipado?: boolean | null
          porcentagem_desconto?: number | null
          porcentagem_pagamento_antecipado?: number | null
          preco?: number
          preco_retorno?: number | null
          procedimento_id?: string | null
          status?: string
          telefone?: string
          tem_desconto?: boolean | null
          tem_retorno?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_procedimento_id_fkey"
            columns: ["procedimento_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          created_at: string
          id: string
          mensagem_enviada: boolean | null
          nome: string
          observacoes: string | null
          retorno_at: string | null
          saldo_credito: number
          status: string | null
          telefone: string
          ultimo_atendimento: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          mensagem_enviada?: boolean | null
          nome: string
          observacoes?: string | null
          retorno_at?: string | null
          saldo_credito?: number
          status?: string | null
          telefone: string
          ultimo_atendimento?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          mensagem_enviada?: boolean | null
          nome?: string
          observacoes?: string | null
          retorno_at?: string | null
          saldo_credito?: number
          status?: string | null
          telefone?: string
          ultimo_atendimento?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      configuracoes_pix: {
        Row: {
          chave_pix: string
          cidade: string
          created_at: string
          id: string
          nome_recebedor: string
          tipo_chave: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chave_pix: string
          cidade: string
          created_at?: string
          id?: string
          nome_recebedor: string
          tipo_chave: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          chave_pix?: string
          cidade?: string
          created_at?: string
          id?: string
          nome_recebedor?: string
          tipo_chave?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      estoque: {
        Row: {
          categoria: string | null
          created_at: string
          id: string
          nome_item: string
          observacoes: string | null
          quantidade: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          id?: string
          nome_item: string
          observacoes?: string | null
          quantidade?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          id?: string
          nome_item?: string
          observacoes?: string | null
          quantidade?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      formas_pagamento: {
        Row: {
          ativa: boolean
          created_at: string
          id: string
          nome: string
          percentual_acrescimo: number | null
          qr_code_pix: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          id?: string
          nome: string
          percentual_acrescimo?: number | null
          qr_code_pix?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativa?: boolean
          created_at?: string
          id?: string
          nome?: string
          percentual_acrescimo?: number | null
          qr_code_pix?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pacote_servicos: {
        Row: {
          created_at: string
          id: string
          pacote_id: string
          servico_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          pacote_id: string
          servico_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          pacote_id?: string
          servico_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pacote_servicos_pacote_id_fkey"
            columns: ["pacote_id"]
            isOneToOne: false
            referencedRelation: "pacotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pacote_servicos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      pacotes: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
          user_id: string | null
          valor_total: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
          user_id?: string | null
          valor_total: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string | null
          valor_total?: number
        }
        Relationships: []
      }
      servicos: {
        Row: {
          categoria: string
          created_at: string
          duracao_minutos: number | null
          id: string
          nome_procedimento: string
          updated_at: string
          user_id: string | null
          valor: number
        }
        Insert: {
          categoria?: string
          created_at?: string
          duracao_minutos?: number | null
          id?: string
          nome_procedimento: string
          updated_at?: string
          user_id?: string | null
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string
          duracao_minutos?: number | null
          id?: string
          nome_procedimento?: string
          updated_at?: string
          user_id?: string | null
          valor?: number
        }
        Relationships: []
      }
      spas_assinaturas: {
        Row: {
          ativa: boolean
          cliente_id: string
          created_at: string
          data_inicio: string
          dia_pagamento: number
          id: string
          observacoes: string | null
          procedimento_id: string | null
          updated_at: string
          user_id: string | null
          valor_mensal: number
        }
        Insert: {
          ativa?: boolean
          cliente_id: string
          created_at?: string
          data_inicio?: string
          dia_pagamento?: number
          id?: string
          observacoes?: string | null
          procedimento_id?: string | null
          updated_at?: string
          user_id?: string | null
          valor_mensal: number
        }
        Update: {
          ativa?: boolean
          cliente_id?: string
          created_at?: string
          data_inicio?: string
          dia_pagamento?: number
          id?: string
          observacoes?: string | null
          procedimento_id?: string | null
          updated_at?: string
          user_id?: string | null
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "spas_assinaturas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spas_assinaturas_procedimento_id_fkey"
            columns: ["procedimento_id"]
            isOneToOne: false
            referencedRelation: "spas_procedimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      spas_pagamentos: {
        Row: {
          assinatura_id: string
          created_at: string
          data_pagamento: string
          forma_pagamento: string | null
          id: string
          mes_referencia: string
          observacoes: string | null
          pago: boolean
          updated_at: string
          user_id: string | null
          valor_pago: number
        }
        Insert: {
          assinatura_id: string
          created_at?: string
          data_pagamento?: string
          forma_pagamento?: string | null
          id?: string
          mes_referencia: string
          observacoes?: string | null
          pago?: boolean
          updated_at?: string
          user_id?: string | null
          valor_pago: number
        }
        Update: {
          assinatura_id?: string
          created_at?: string
          data_pagamento?: string
          forma_pagamento?: string | null
          id?: string
          mes_referencia?: string
          observacoes?: string | null
          pago?: boolean
          updated_at?: string
          user_id?: string | null
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "spas_pagamentos_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "spas_assinaturas"
            referencedColumns: ["id"]
          },
        ]
      }
      spas_procedimentos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          duracao_minutos: number | null
          id: string
          nome: string
          updated_at: string
          user_id: string | null
          valor: number | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          nome: string
          updated_at?: string
          user_id?: string | null
          valor?: number | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number | null
          id?: string
          nome?: string
          updated_at?: string
          user_id?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      spas_sessoes: {
        Row: {
          assinatura_id: string
          created_at: string
          data_sessao: string
          hora_sessao: string | null
          id: string
          observacoes: string | null
          realizada: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assinatura_id: string
          created_at?: string
          data_sessao: string
          hora_sessao?: string | null
          id?: string
          observacoes?: string | null
          realizada?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assinatura_id?: string
          created_at?: string
          data_sessao?: string
          hora_sessao?: string | null
          id?: string
          observacoes?: string | null
          realizada?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spas_sessoes_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "spas_assinaturas"
            referencedColumns: ["id"]
          },
        ]
      }
      transacoes: {
        Row: {
          agendamento_id: string | null
          created_at: string
          data_transacao: string
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          tipo: string
          tipo_operacao: string
          updated_at: string
          user_id: string | null
          valor: number
        }
        Insert: {
          agendamento_id?: string | null
          created_at?: string
          data_transacao?: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          tipo: string
          tipo_operacao: string
          updated_at?: string
          user_id?: string | null
          valor: number
        }
        Update: {
          agendamento_id?: string | null
          created_at?: string
          data_transacao?: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          tipo?: string
          tipo_operacao?: string
          updated_at?: string
          user_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
