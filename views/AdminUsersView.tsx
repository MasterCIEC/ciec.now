import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile, Role } from '../types';
import Button from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import Select from '../components/ui/Select';

interface AdminUsersViewProps {
  onNavigateBack?: () => void;
}

const AdminUsersView: React.FC<AdminUsersViewProps> = ({ onNavigateBack }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsersAndRoles = useCallback(async () => {
    setLoading(true);
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('userprofiles')
        .select('*');

      if (usersError) throw usersError;
      setUsers(usersData as any);

      const { data: rolesData, error: rolesError } = await supabase
        .from('roles')
        .select('*');
      
      if (rolesError) throw rolesError;
      setRoles(rolesData);

    } catch (err: any) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsersAndRoles();
  }, [fetchUsersAndRoles]);

  const handleApproveUser = async (userId: string) => {
    const { error } = await supabase
      .from('userprofiles')
      .update({ is_approved: true })
      .eq('id', userId);
    
    if (error) {
      alert(`Error al aprobar usuario: ${error.message}`);
    } else {
      fetchUsersAndRoles(); // Refresh list
    }
  };

  const handleRoleChange = async (userId: string, newRoleId: string) => {
    const { error } = await supabase
      .from('userprofiles')
      .update({ role_id: parseInt(newRoleId, 10) })
      .eq('id', userId);

    if (error) {
      alert(`Error al cambiar el rol: ${error.message}`);
    } else {
      fetchUsersAndRoles(); // Refresh list
    }
  };

  if (loading) return <div className="p-6">Cargando usuarios...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;
  
  const roleOptions = roles.map(r => ({ value: r.id, label: r.name }));

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Gestionar Usuarios</h1>
        {onNavigateBack && <Button onClick={onNavigateBack} variant="secondary">Volver al Menú</Button>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Usuarios</CardTitle>
          <CardDescription>Aprobar nuevos registros y asignar roles.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                {users.map(user => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{user.full_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                       <Select 
                         options={roleOptions}
                         value={user.role_id ?? ''}
                         onChange={(e) => handleRoleChange(user.id, e.target.value)}
                         className="w-full max-w-[150px] !py-1"
                       />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {user.is_approved 
                        ? <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">Aprobado</span>
                        : <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100">Pendiente</span>
                      }
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {!user.is_approved && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleApproveUser(user.id)}
                        >
                          Aprobar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUsersView;