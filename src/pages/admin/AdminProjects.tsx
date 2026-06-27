import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from './AdminLayout'
import { Pencil, Trash2, Plus } from 'lucide-react'

export default function AdminProjects() {
  const navigate = useNavigate()
  const [list, setList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editModal, setEditModal] = useState<any>(null)
  const [addModal, setAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [addForm, setAddForm] = useState({ name: '', contract_address: '', chain: 'bsc', info_completeness: '' })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  const fetchList = async (q: string) => {
    const token = localStorage.getItem('admin_token')
    if (!token) { navigate('/admin/login'); return }
    setLoading(true)
    try {
      const url = q ? `/api/admin/projects?search=${encodeURIComponent(q)}` : '/api/admin/projects'
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (data.success) setList(data.data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { fetchList(search) }, [navigate])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); fetchList(search) }

  const handleRename = async () => {
    const token = localStorage.getItem('admin_token')
    if (!token || !editModal) return
    try {
      const res = await fetch('/api/admin/projects/rename', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: editModal.id, name: newName }),
      })
      const data = await res.json()
      if (data.success) { showToast('名称已更新', 'success'); setEditModal(null); setNewName(''); fetchList(search) }
      else { showToast(data.error || '修改失败', 'error') }
    } catch { showToast('请求失败，请检查服务器', 'error') }
  }

  const handleAdd = async () => {
    if (!addForm.name.trim()) return
    const token = localStorage.getItem('admin_token')
    if (!token) return
    try {
      const res = await fetch('/api/admin/projects/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(addForm),
      })
      const data = await res.json()
      if (data.success) { showToast('项目已添加', 'success'); setAddModal(false); setAddForm({ name: '', contract_address: '', chain: 'bsc', info_completeness: '' }); fetchList(search) }
      else { showToast(data.error || '添加失败', 'error') }
    } catch { showToast('请求失败', 'error') }
  }

  const handleDelete = async () => {
    const token = localStorage.getItem('admin_token')
    if (!token || !deleteConfirm) return
    try {
      const res = await fetch('/api/admin/projects/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: deleteConfirm }),
      })
      const data = await res.json()
      if (data.success) { showToast('项目已删除', 'success'); setDeleteConfirm(null); fetchList(search) }
      else { showToast(data.error || '删除失败', 'error') }
    } catch { showToast('请求失败', 'error') }
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-white text-lg font-bold">项目库管理</h1>
        <button onClick={() => setAddModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs">
          <Plus className="w-3.5 h-3.5" /> 添加项目
        </button>
      </div>

      {/* 搜索 */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜索项目名称..."
          className="flex-1 px-3 py-1.5 bg-gray-800 text-white text-xs rounded border border-gray-700 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <button type="submit" className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-xs">搜索</button>
      </form>

      {loading ? <p className="text-gray-400 text-sm">加载中...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-gray-300">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500">
                <th className="text-left py-2 pr-2">名称</th>
                <th className="text-center py-2 pr-2 w-14">可信</th>
                <th className="text-left py-2 pr-2">合约地址</th>
                <th className="text-left py-2 pr-2">链</th>
                <th className="text-right py-2 pr-2">评估次数</th>
                <th className="text-left py-2 pr-2">最后评估</th>
                <th className="text-right py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map(item => (
                <tr key={item.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-2 pr-2 font-medium">{item.name}</td>
                  <td className="py-2 pr-2 text-center">
                    <button
                      onClick={async () => {
                        const token = localStorage.getItem('admin_token')
                        if (!token) return
                        try {
                          const res = await fetch('/api/admin/projects/trust', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({ id: item.id, is_trusted: !item.is_trusted }),
                          })
                          const data = await res.json()
                          if (data.success) {
                            showToast(item.is_trusted ? '已取消可信标记' : '已标记为可信项目', 'success')
                            fetchList(search)
                          }
                        } catch { showToast('操作失败', 'error') }
                      }}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                        item.is_trusted
                          ? 'bg-green-900 text-green-300 hover:bg-green-800'
                          : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                      }`}
                      title={item.is_trusted ? '取消可信标记' : '标记为可信项目（豁免崩盘检测）'}
                    >
                      {item.is_trusted ? '✓ 可信' : '—'}
                    </button>
                  </td>
                  <td className="py-2 pr-2 font-mono text-gray-400">
                    {item.contract_address ? item.contract_address.slice(0, 10) + '...' : '--'}
                  </td>
                  <td className="py-2 pr-2">{item.chain || '--'}</td>
                  <td className="py-2 pr-2 text-right">{item.assessment_count || 0}</td>
                  <td className="py-2 pr-2 text-gray-400">{item.last_eval_time?.slice(0, 10) || '--'}</td>
                  <td className="py-2 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => { setEditModal(item); setNewName(item.name) }}
                        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-blue-400" title="编辑名称">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteConfirm(item.id)}
                        className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-red-400" title="删除">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-500">暂无项目</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* 编辑名称弹窗 */}
      {editModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 w-80 space-y-3">
            <h3 className="text-white text-sm font-semibold">编辑项目名称</h3>
            <p className="text-gray-400 text-xs">原名称：{editModal.name}</p>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="新名称" autoFocus
              className="w-full px-3 py-2 bg-gray-800 text-white text-xs rounded border border-gray-700 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            <div className="flex gap-3 pt-1">
              <button onClick={() => setEditModal(null)}
                className="flex-1 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-xs">取消</button>
              <button onClick={handleRename}
                className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 添加项目弹窗 */}
      {addModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 w-80 space-y-3">
            <h3 className="text-white text-sm font-semibold">添加项目</h3>
            <div className="space-y-2">
              <input value={addForm.name} onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="项目名称 *" className="w-full px-3 py-2 bg-gray-800 text-white text-xs rounded border border-gray-700 placeholder-gray-500 focus:outline-none" />
              <input value={addForm.contract_address} onChange={e => setAddForm({ ...addForm, contract_address: e.target.value })}
                placeholder="合约地址" className="w-full px-3 py-2 bg-gray-800 text-white text-xs rounded border border-gray-700 placeholder-gray-500 focus:outline-none" />
              <select value={addForm.chain} onChange={e => setAddForm({ ...addForm, chain: e.target.value })}
                className="w-full px-3 py-2 bg-gray-800 text-white text-xs rounded border border-gray-700 focus:outline-none">
                <option value="bsc">BSC</option><option value="ethereum">Ethereum</option><option value="polygon">Polygon</option>
                <option value="arbitrum">Arbitrum</option><option value="tron">TRON</option><option value="solana">Solana</option>
              </select>
              <input value={addForm.info_completeness} onChange={e => setAddForm({ ...addForm, info_completeness: e.target.value })}
                placeholder="信息完整性评分（可选）" type="number" className="w-full px-3 py-2 bg-gray-800 text-white text-xs rounded border border-gray-700 placeholder-gray-500 focus:outline-none" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setAddModal(false)}
                className="flex-1 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-xs">取消</button>
              <button onClick={handleAdd} disabled={!addForm.name.trim()}
                className="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs">添加</button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 w-80 space-y-3">
            <h3 className="text-white text-sm font-semibold">确认删除</h3>
            <p className="text-gray-300 text-xs">删除后无法恢复，确定要删除该项目吗？</p>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-xs">取消</button>
              <button onClick={handleDelete}
                className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs">确认删除</button>
            </div>
          </div>
        </div>
      )}
      {/* Toast 通知 */}
      {toast && (
        <div className="fixed top-4 right-4 z-[99999] animate-bounce">
          <div className={`px-4 py-2 rounded-lg text-xs font-medium shadow-lg ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {toast.msg}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
