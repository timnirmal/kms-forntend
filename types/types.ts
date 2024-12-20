export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      blocks: {
        Row: {
          content: string | null
          embedding: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      chat: {
        Row: {
          chat_id: string
          context: string | null
          created_at: string
          function_call: string | null
          function_call_text: string | null
          message: string | null
          mode: string | null
          openai_id: string | null
          role: string | null
          session_id: string | null
          user: string | null
        }
        Insert: {
          chat_id?: string
          context?: string | null
          created_at?: string
          function_call?: string | null
          function_call_text?: string | null
          message?: string | null
          mode?: string | null
          openai_id?: string | null
          role?: string | null
          session_id?: string | null
          user?: string | null
        }
        Update: {
          chat_id?: string
          context?: string | null
          created_at?: string
          function_call?: string | null
          function_call_text?: string | null
          message?: string | null
          mode?: string | null
          openai_id?: string | null
          role?: string | null
          session_id?: string | null
          user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "chat_user_fkey"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      colab: {
        Row: {
          created_at: string
          id: string
          level: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          level?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          level?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colab_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "session"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "colab_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          chunk_id: string | null
          document_content: string | null
          document_id: string | null
          embedding: string | null
          metadata: Json | null
        }
        Insert: {
          chunk_id?: string | null
          document_content?: string | null
          document_id?: string | null
          embedding?: string | null
          metadata?: Json | null
        }
        Update: {
          chunk_id?: string | null
          document_content?: string | null
          document_id?: string | null
          embedding?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      databases: {
        Row: {
          chunk_id: string | null
          document_content: string | null
          document_id: string | null
          embedding: string | null
          metadata: Json | null
        }
        Insert: {
          chunk_id?: string | null
          document_content?: string | null
          document_id?: string | null
          embedding?: string | null
          metadata?: Json | null
        }
        Update: {
          chunk_id?: string | null
          document_content?: string | null
          document_id?: string | null
          embedding?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      department: {
        Row: {
          created_at: string
          department_id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          department_id?: string
          name?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string
          name?: string | null
        }
        Relationships: []
      }
      docs: {
        Row: {
          content: string
          doc_id: string
          embedding: string
          lastupdated: string
          metadata: Json | null
        }
        Insert: {
          content: string
          doc_id: string
          embedding: string
          lastupdated: string
          metadata?: Json | null
        }
        Update: {
          content?: string
          doc_id?: string
          embedding?: string
          lastupdated?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          content: string | null
          embedding: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id: string
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      documents_figma: {
        Row: {
          content: string
          doc_id: string
          embedding: string
          lastupdated: string
          metadata: Json | null
        }
        Insert: {
          content: string
          doc_id: string
          embedding: string
          lastupdated: string
          metadata?: Json | null
        }
        Update: {
          content?: string
          doc_id?: string
          embedding?: string
          lastupdated?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      documents2: {
        Row: {
          content: string | null
          doc_id: string
          embedding: string | null
          lastupdated: string | null
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          doc_id?: string
          embedding?: string | null
          lastupdated?: string | null
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          doc_id?: string
          embedding?: string | null
          lastupdated?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      documents3: {
        Row: {
          content: string | null
          doc_id: string
          embedding: string | null
          lastupdated: string | null
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          doc_id?: string
          embedding?: string | null
          lastupdated?: string | null
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          doc_id?: string
          embedding?: string | null
          lastupdated?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      documents4: {
        Row: {
          content: string | null
          doc_id: string
          embedding: string | null
          lastupdated: string | null
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          doc_id?: string
          embedding?: string | null
          lastupdated?: string | null
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          doc_id?: string
          embedding?: string | null
          lastupdated?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      documents5: {
        Row: {
          content: string | null
          doc_id: string
          embedding: string | null
          lastupdated: string | null
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          doc_id?: string
          embedding?: string | null
          lastupdated?: string | null
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          doc_id?: string
          embedding?: string | null
          lastupdated?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      documents6: {
        Row: {
          content: string
          doc_id: string
          embedding: string
          lastupdated: string
          metadata: Json | null
        }
        Insert: {
          content: string
          doc_id: string
          embedding: string
          lastupdated: string
          metadata?: Json | null
        }
        Update: {
          content?: string
          doc_id?: string
          embedding?: string
          lastupdated?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      job_status: {
        Row: {
          finished_at: string | null
          job_id: string
          message: string | null
          source_table: string
          started_at: string
          status: string
        }
        Insert: {
          finished_at?: string | null
          job_id?: string
          message?: string | null
          source_table: string
          started_at?: string
          status: string
        }
        Update: {
          finished_at?: string | null
          job_id?: string
          message?: string | null
          source_table?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      pages: {
        Row: {
          chunk_id: string | null
          document_content: string | null
          document_id: string | null
          embedding: string | null
          metadata: Json | null
        }
        Insert: {
          chunk_id?: string | null
          document_content?: string | null
          document_id?: string | null
          embedding?: string | null
          metadata?: Json | null
        }
        Update: {
          chunk_id?: string | null
          document_content?: string | null
          document_id?: string | null
          embedding?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string
          primary_access_level: number | null
          primary_deparment: string | null
          role: string | null
          second_name: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id: string
          primary_access_level?: number | null
          primary_deparment?: string | null
          role?: string | null
          second_name?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          primary_access_level?: number | null
          primary_deparment?: string | null
          role?: string | null
          second_name?: string | null
          username?: string | null
        }
        Relationships: []
      }
      session: {
        Row: {
          created_at: string
          department: string | null
          mode: string | null
          session_id: string
          shared: boolean | null
          summery: string | null
          summery_date: string | null
          user: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          mode?: string | null
          session_id?: string
          shared?: boolean | null
          summery?: string | null
          summery_date?: string | null
          user?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          mode?: string | null
          session_id?: string
          shared?: boolean | null
          summery?: string | null
          summery_date?: string | null
          user?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_department_fkey"
            columns: ["department"]
            isOneToOne: false
            referencedRelation: "department"
            referencedColumns: ["department_id"]
          },
          {
            foreignKeyName: "session_user_fkey"
            columns: ["user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspace"
            referencedColumns: ["workspace_id"]
          },
        ]
      }
      sync_config: {
        Row: {
          id: string
          last_sync: string | null
          source_table: string | null
        }
        Insert: {
          id?: string
          last_sync?: string | null
          source_table?: string | null
        }
        Update: {
          id?: string
          last_sync?: string | null
          source_table?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          chunk_id: string | null
          document_content: string | null
          document_id: string | null
          embedding: string | null
          metadata: Json | null
        }
        Insert: {
          chunk_id?: string | null
          document_content?: string | null
          document_id?: string | null
          embedding?: string | null
          metadata?: Json | null
        }
        Update: {
          chunk_id?: string | null
          document_content?: string | null
          document_id?: string | null
          embedding?: string | null
          metadata?: Json | null
        }
        Relationships: []
      }
      workspace: {
        Row: {
          created_at: string
          owner: string | null
          workspace_id: string
          workspace_name: string | null
        }
        Insert: {
          created_at?: string
          owner?: string | null
          workspace_id?: string
          workspace_name?: string | null
        }
        Update: {
          created_at?: string
          owner?: string | null
          workspace_id?: string
          workspace_name?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize:
        | {
            Args: {
              "": string
            }
            Returns: unknown
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
      halfvec_avg: {
        Args: {
          "": number[]
        }
        Returns: unknown
      }
      halfvec_out: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      halfvec_send: {
        Args: {
          "": unknown
        }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
      hnsw_bit_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnswhandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflathandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      l2_norm:
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
      l2_normalize:
        | {
            Args: {
              "": string
            }
            Returns: string
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
      match_blocks: {
        Args: {
          query_embedding: string
          filter?: Json
        }
        Returns: {
          id: string
          content: string
          metadata: Json
          similarity: number
        }[]
      }
      match_docs_main: {
        Args: {
          query_embedding: string
          filter?: Json
        }
        Returns: {
          document_id: string
          page_content: string
          metadata: Json
          similarity: number
        }[]
      }
      match_documents:
        | {
            Args: {
              query_embedding: string
              match_count?: number
              min_similarity?: number
            }
            Returns: {
              doc_id: string
              content: string
              metadata: Json
              similarity: number
            }[]
          }
        | {
            Args: {
              query_embedding: string
              match_count?: number
              min_similarity?: number
              department_filter?: string
            }
            Returns: {
              id: number
              content: string
              metadata: Json
              similarity: number
            }[]
          }
        | {
            Args: {
              query_embedding: string
              match_count?: number
              min_similarity?: number
              filter?: Json
            }
            Returns: {
              id: string
              content: string
              metadata: Json
              similarity: number
            }[]
          }
        | {
            Args: {
              query_embedding: string
              table_name: string
              match_count?: number
              min_similarity?: number
              department_filter?: string
            }
            Returns: {
              id: string
              content: string
              metadata: Json
              embedding: string
              similarity: number
            }[]
          }
      match_documents_function_figma:
        | {
            Args: {
              query_embedding: string
              filter?: Json
            }
            Returns: {
              document_id: string
              page_content: string
              metadata: Json
              similarity: number
            }[]
          }
        | {
            Args: {
              query_embedding: string
              similarity_threshold: number
              filter?: Json
            }
            Returns: {
              document_id: string
              page_content: string
              similarity_score: number
              metadata: Json
            }[]
          }
      match_documents_pasi: {
        Args: {
          query_embedding: string
          filter?: Json
        }
        Returns: {
          id: string
          content: string
          metadata: Json
          similarity: number
        }[]
      }
      match_documents_v2: {
        Args: {
          query_embedding: string
          match_count?: number
          min_similarity?: number
          filter_department?: string
        }
        Returns: {
          id: string
          content: string
          metadata: Json
          similarity: number
        }[]
      }
      match_documents_v3: {
        Args: {
          query_embedding: string
          match_count?: number
          min_similarity?: number
          filter_department?: string
        }
        Returns: {
          id: string
          content: string
          metadata: Json
          similarity: number
        }[]
      }
      match_documents4: {
        Args: {
          query_embedding: string
          match_count?: number
          min_similarity?: number
        }
        Returns: {
          id: string
          content: string
          metadata: Json
          similarity: number
        }[]
      }
      match_documents6: {
        Args: {
          query_embedding: string
          filter?: Json
        }
        Returns: {
          document_id: string
          page_content: string
          metadata: Json
          similarity: number
        }[]
      }
      match_hr_documents: {
        Args: {
          query_embedding: string
          match_count: number
        }
        Returns: {
          doc_id: string
          content: string
          metadata: Json
          similarity: number
        }[]
      }
      sparsevec_out: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      sparsevec_send: {
        Args: {
          "": unknown
        }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
      vector_avg: {
        Args: {
          "": number[]
        }
        Returns: string
      }
      vector_dims:
        | {
            Args: {
              "": string
            }
            Returns: number
          }
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
      vector_norm: {
        Args: {
          "": string
        }
        Returns: number
      }
      vector_out: {
        Args: {
          "": string
        }
        Returns: unknown
      }
      vector_send: {
        Args: {
          "": string
        }
        Returns: string
      }
      vector_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
