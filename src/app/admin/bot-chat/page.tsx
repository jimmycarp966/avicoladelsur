'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

interface BotMessage {
  id: string
  phone_number: string
  message: string
  direction: 'incoming' | 'outgoing'
  cliente_id?: string
  created_at: string
  metadata?: Record<string, any>
}

interface Conversation {
  phone_number: string
  cliente_id?: string
  last_message_at: string
  incoming_count: number
  outgoing_count: number
  last_message: string
}

export default function BotChatDashboard() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [messages, setMessages] = useState<BotMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDirection, setFilterDirection] = useState<'all' | 'incoming' | 'outgoing'>('all')
  const [showNotification, setShowNotification] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState('')

  useEffect(() => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Cargar conversaciones iniciales
    loadConversations(supabase)

    // Escuchar nuevos mensajes en tiempo real
    const channel = supabase
      .channel('bot-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bot_messages'
        },
        (payload) => {
          const newMessage = payload.new as BotMessage
          
          // Mostrar notificación
          showNewMessageNotification(newMessage)
          
          // Actualizar mensajes si está seleccionada la conversación
          if (selectedPhone === newMessage.phone_number) {
            setMessages((prev) => [...prev, newMessage])
          }
          
          // Recargar conversaciones para actualizar la lista
          loadConversations(supabase)
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [selectedPhone])

  useEffect(() => {
    if (selectedPhone) {
      loadMessages(selectedPhone)
    }
  }, [selectedPhone])

  useEffect(() => {
    // Filtrar conversaciones basado en búsqueda
    let filtered = conversations

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(conv => 
        conv.phone_number.includes(term) ||
        conv.last_message.toLowerCase().includes(term)
      )
    }

    if (filterDirection !== 'all') {
      filtered = filtered.filter(conv => {
        if (filterDirection === 'incoming') {
          return conv.incoming_count > 0
        } else {
          return conv.outgoing_count > 0
        }
      })
    }

    setFilteredConversations(filtered)
  }, [searchTerm, filterDirection, conversations])

  async function loadConversations(supabase: any) {
    try {
      const { data, error } = await supabase
        .from('bot_conversations')
        .select('*')
        .order('last_message_at', { ascending: false })
        .limit(100)

      if (error) throw error
      setConversations(data || [])
    } catch (error) {
      console.error('Error cargando conversaciones:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages(phoneNumber: string) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data, error } = await supabase
        .from('bot_messages')
        .select('*')
        .eq('phone_number', phoneNumber)
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) throw error
      setMessages(data || [])
    } catch (error) {
      console.error('Error cargando mensajes:', error)
    }
  }

  function showNewMessageNotification(message: BotMessage) {
    const direction = message.direction === 'incoming' ? 'Nuevo mensaje de' : 'Bot respondió a'
    setNotificationMessage(`${direction} ${formatPhoneNumber(message.phone_number)}`)
    setShowNotification(true)
    
    // Ocultar notificación después de 3 segundos
    setTimeout(() => {
      setShowNotification(false)
    }, 3000)
  }

  function formatPhoneNumber(phone: string): string {
    if (phone.startsWith('+54')) {
      return phone.replace('+54', '0')
    }
    return phone
  }

  function formatTime(date: string): string {
    return new Date(date).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function formatDate(date: string): string {
    return new Date(date).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Notificación flotante */}
      {showNotification && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="text-xl">🔔</span>
            <span>{notificationMessage}</span>
          </div>
        </div>
      )}

      {/* Sidebar - Lista de conversaciones */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-800">Dashboard del Bot</h1>
          <p className="text-sm text-gray-500 mt-1">
            {filteredConversations.length} conversaciones activas
          </p>
        </div>

        {/* Búsqueda */}
        <div className="p-4 border-b border-gray-200">
          <input
            type="text"
            placeholder="Buscar por teléfono o mensaje..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        {/* Filtros */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex gap-2">
            <button
              onClick={() => setFilterDirection('all')}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filterDirection === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterDirection('incoming')}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filterDirection === 'incoming'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              📥 Entrantes
            </button>
            <button
              onClick={() => setFilterDirection('outgoing')}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filterDirection === 'outgoing'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              📤 Salientes
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">
              Cargando conversaciones...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              {searchTerm ? 'No se encontraron resultados' : 'No hay conversaciones aún'}
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.phone_number}
                onClick={() => setSelectedPhone(conv.phone_number)}
                className={`w-full p-4 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  selectedPhone === conv.phone_number ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-gray-800">
                    {formatPhoneNumber(conv.phone_number)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatTime(conv.last_message_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 truncate">
                  {conv.last_message}
                </p>
                <div className="flex gap-2 mt-2 text-xs text-gray-500">
                  <span>📥 {conv.incoming_count}</span>
                  <span>📤 {conv.outgoing_count}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat principal */}
      <div className="flex-1 flex flex-col">
        {selectedPhone ? (
          <>
            {/* Header */}
            <div className="p-4 bg-white border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    {formatPhoneNumber(selectedPhone)}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {messages.length} mensajes
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPhone(null)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.direction === 'incoming' ? 'justify-start' : 'justify-end'
                  }`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      msg.direction === 'incoming'
                        ? 'bg-white border border-gray-200'
                        : 'bg-blue-500 text-white'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {msg.message}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        msg.direction === 'incoming'
                          ? 'text-gray-500'
                          : 'text-blue-100'
                      }`}
                    >
                      {formatTime(msg.created_at)} - {formatDate(msg.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">Selecciona una conversación</p>
              <p className="text-sm">
                Haz clic en un número de teléfono de la lista para ver el chat
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
