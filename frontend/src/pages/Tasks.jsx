import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Play, Trash2, Loader2, Clock, CheckCircle2, XCircle,
  X, ChevronRight, FileText,
} from 'lucide-react'
import { api } from '../api'

const TARGET_LABEL = { shopify: 'Shopify', generic: '通用 API', csv: 'CSV 导出' }
const TASK_STATUS_LABEL = {
  idle: '空闲', running: '运行中', paused: '已暂停', done: '已完成', error: '出错',
}
const TASK_STATUS_STYLE = {
  idle: 'bg-gray-100 text-gray-600', running: 'bg-blue-50 text-blue-600',
  paused: 'bg-amber-50 text-amber-600', done: 'bg-emerald-50 text-emerald-600',
  error: 'bg-red-50 text-red-600',
}

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [detail, setDetail] = useState(null)

  const load = useCallback(async () => {
    try {
      const data = await api.tasks()
      setTasks(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [load])

  async function run(id) {
    await api.runTask(id)
    setTimeout(load, 500)
  }

  async function remove(id) {
    if (!confirm('确认删除该任务？')) return
    await api.deleteTask(id)
    load()
  }

  return (
    <div className="space-y-4 p-4">
      {/* 顶部操作区 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">创建并执行自动铺货任务</p>
        <button
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700"
          onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> 新建
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : tasks.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm py-16 text-center text-gray-400 text-sm">
            暂无任务，点击「新建」创建第一个铺货任务
          </div>
        ) : (
          tasks.map((t) => (
            <div key={t.id} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800 text-sm">{t.name}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TASK_STATUS_STYLE[t.status] || ''}`}>
                      {TASK_STATUS_LABEL[t.status] || t.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {TARGET_LABEL[t.target_type] || t.target_type}
                    </span>
                    {t.cron_expr && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-600">
                        <Clock className="w-3 h-3 mr-1" />{t.cron_expr}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>筛选: {t.filter_status || '全部'} {t.filter_keyword && `· ${t.filter_keyword}`}</span>
                    <span>加价 {t.markup_ratio}x</span>
                    <span>上限 {t.limit}</span>
                  </div>
                  {(t.last_run_at || t.next_run_at) && (
                    <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-x-3">
                      {t.last_run_at && <span>上次: {t.last_run_at.replace('T', ' ').slice(0, 19)}</span>}
                      {t.next_run_at && <span>下次: {t.next_run_at.replace('T', ' ').slice(0, 19)}</span>}
                    </div>
                  )}
                </div>
              </div>
              {t.total > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-gray-500">共 {t.total}</span>
                    <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{t.success}</span>
                    <span className="text-red-500 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />{t.failed}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${t.total ? (t.success / t.total * 100) : 0}%` }} />
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
                <button
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => run(t.id)} disabled={t.status === 'running'}>
                  {t.status === 'running' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  执行
                </button>
                <button
                  className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                  onClick={() => setDetail(t)}>
                  <FileText className="w-4 h-4" /> 详情
                </button>
                <button
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 border border-red-100"
                  onClick={() => remove(t.id)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load() }} />}
      {detail && <TaskDetail task={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function CreateTaskModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', target_type: 'csv', task_type: 'once',
    filter_status: 'mapped', filter_keyword: '', filter_category: '',
    filter_tags: '', limit: 50, markup_ratio: 1.3, auto_map_category: true,
    cron_expr: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setErr('')
    try {
      await api.createTask(form)
      onCreated()
    } catch (e2) { setErr(e2.message) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl shadow-xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        {/* 顶部拖拽条（仅移动端视觉） */}
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-gray-800 text-sm">新建铺货任务</span>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">任务名称</label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例: 手机壳批量铺货" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">目标平台</label>
              <select
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                value={form.target_type} onChange={(e) => setForm({ ...form, target_type: e.target.value })}>
                <option value="csv">CSV 导出（免配置）</option>
                <option value="shopify">Shopify</option>
                <option value="generic">通用 API</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">任务类型</label>
              <select
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })}>
                <option value="once">立即/一次性</option>
                <option value="scheduled">定时</option>
              </select>
            </div>
          </div>
          {form.task_type === 'scheduled' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cron 表达式（分 时 日 月 周）</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                value={form.cron_expr} onChange={(e) => setForm({ ...form, cron_expr: e.target.value })}
                placeholder="例: 0 9 * * * 每天9点" />
              <p className="text-xs text-gray-400 mt-1">0 9 * * * = 每天9点 / 0 */2 * * * = 每2小时</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">筛选状态</label>
              <select
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                value={form.filter_status} onChange={(e) => setForm({ ...form, filter_status: e.target.value })}>
                <option value="mapped">已映射</option>
                <option value="sourced">已采集</option>
                <option value="pending">待铺货</option>
                <option value="pushed">已铺货</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">商品上限</label>
              <input type="number"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                value={form.limit} onChange={(e) => setForm({ ...form, limit: parseInt(e.target.value) || 50 })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">关键词筛选</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                value={form.filter_keyword} onChange={(e) => setForm({ ...form, filter_keyword: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">类目筛选</label>
              <input
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                value={form.filter_category} onChange={(e) => setForm({ ...form, filter_category: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">加价倍率</label>
            <input type="number" step="0.1"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              value={form.markup_ratio} onChange={(e) => setForm({ ...form, markup_ratio: parseFloat(e.target.value) || 1.3 })} />
          </div>
          {err && <div className="text-red-500 text-sm">{err}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button"
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              onClick={onClose}>取消</button>
            <button type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} 创建
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TaskDetail({ task, onClose }) {
  const [tab, setTab] = useState('records')
  const [records, setRecords] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.taskRecords(task.id, { page_size: 100 }), api.taskLogs(task.id)])
      .then(([r, l]) => { setRecords(r.items); setLogs(l) })
      .finally(() => setLoading(false))
  }, [task.id])

  return (
    <div className="fixed inset-0 bg-black/30 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <span className="font-semibold text-gray-800 text-sm">{task.name} · 执行详情</span>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-4 pt-3">
          <div className="flex gap-1 border-b border-gray-100">
            <button
              className={`px-3 py-2 text-sm font-medium ${tab === 'records' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500'}`}
              onClick={() => setTab('records')}>铺货记录</button>
            <button
              className={`px-3 py-2 text-sm font-medium ${tab === 'logs' ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500'}`}
              onClick={() => setTab('logs')}>执行日志</button>
          </div>
        </div>
        <div className="p-4">
          {loading ? <div className="text-center py-8 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div> : tab === 'records' ? (
            <div className="space-y-2">
              {records.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">暂无记录</div> :
                records.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                    {r.status === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" /> : <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-800 truncate">{r.message}</div>
                      {r.target_item_url && <a href={r.target_item_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline truncate block">{r.target_item_url}</a>}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{r.created_at?.replace('T', ' ').slice(0, 19)}</span>
                  </div>
                ))}
            </div>
          ) : (
            <div className="space-y-1 font-mono text-xs">
              {logs.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">暂无日志</div> :
                logs.map((l) => (
                  <div key={l.id} className="flex gap-2 py-1">
                    <span className="text-gray-400 shrink-0">{l.created_at?.replace('T', ' ').slice(11, 19)}</span>
                    <span className={`shrink-0 ${l.level === 'ERROR' ? 'text-red-500' : 'text-emerald-500'}`}>[{l.level}]</span>
                    <span className="text-gray-700">{l.message}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
