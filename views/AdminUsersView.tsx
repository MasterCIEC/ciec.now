import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { UserProfile, Role } from '../types';
import Button from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import Select from '../components/ui/Select';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/Modal';
import Input from '../components/ui/Input';
import PlusIcon from '../components/icons/PlusIcon';
import EditIcon from '../components/icons/EditIcon';
import TrashIcon from '../components/icons/TrashIcon';

interface AdminUsersViewProps {
  onNavigateBack?: () => void;
  users: UserProfile[];
  roles: Role[];
  onUpdate: () => void;
}

interface Permission {
  id: number;
  action: string;
  subject: string;
}

interface ManagePermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roles: Role[];
  profile: UserProfile | null;
  onRolesUpdated: () => void;
}

const ManagePermissionsModal: React.FC<ManagePermissionsModalProps> = ({
  isOpen,
  onClose,
  roles: initialRoles,
  profile,
  onRolesUpdated,
}) => {
  const [roles, setRoles] = useState<Role[]>(initialRoles);
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [initialRolePermissions, setInitialRolePermissions] = useState<Record<number, number[]>>({});
  const [rolePermissions, setRolePermissions] = useState<Record<number, number[]>>({});
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [roleFormMode, setRoleFormMode] = useState<'create' | 'edit' | null>(null);
  const [roleToManage, setRoleToManage] = useState<Role | null>(null);
  const [roleNameInput, setRoleNameInput] = useState('');
  const [roleFormSubmitting, setRoleFormSubmitting] = useState(false);

  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [usersWithRoleCount, setUsersWithRoleCount] = useState(0);
  const [isCheckingUsage, setIsCheckingUsage] = useState(false);
  const [saveResultModalInfo, setSaveResultModalInfo] = useState<{ title: string, message: string, success: boolean } | null>(null);
  
  const isSuperAdmin = profile?.roles?.name === 'SuperAdmin';

  useEffect(() => {
    const newlyCreatedRole = initialRoles.find(r => !roles.some(or => or.id === r.id));
    setRoles(initialRoles);
    if (newlyCreatedRole) {
      setSelectedRole(newlyCreatedRole);
    }
  }, [initialRoles, roles]);

  const translations: {
    subjects: Record<string, string>;
    actions: Record<string, string>;
  } = {
    subjects: {
      Meeting: 'Reuniones',
      Participant: 'Participantes',
      Users: 'Usuarios',
      Commission: 'Comisiones',
      EventCategory: 'Categorías de Eventos',
    },
    actions: {
      Create: 'Insertar',
      Read: 'Leer',
      Update: 'Actualizar',
      Delete: 'Borrar',
      Manage: 'Gestionar',
    },
  };

  const translate = (type: 'subjects' | 'actions', text: string): string => {
    return translations[type][text] || text;
  };

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setLoading(true);
        try {
          const { data: permissionsData, error: permissionsError } = await supabase.from('permissions').select('*');
          if (permissionsError) throw permissionsError;
          setAllPermissions((permissionsData as any) || []);

          const { data: rolePermsData, error: rolePermsError } = await supabase.from('rolepermissions').select('role_id, permission_id');
          if (rolePermsError) throw rolePermsError;

          const permsMap: Record<number, number[]> = {};
          for (const role of initialRoles) {
            permsMap[role.id] = (rolePermsData as any[])
              .filter(rp => rp.role_id === role.id)
              .map(rp => rp.permission_id);
          }
          setInitialRolePermissions(permsMap);
          setRolePermissions(JSON.parse(JSON.stringify(permsMap)));

        } catch (error: any) {
          console.error("Error fetching permissions data:", error);
          setSaveResultModalInfo({ title: 'Error de Carga', message: 'No se pudieron cargar los datos de permisos.', success: false });
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen, initialRoles]);

  useEffect(() => {
    if (isOpen && roles.length > 0 && !selectedRole) {
      setSelectedRole(roles[0]);
    } else if (isOpen && roles.length > 0 && selectedRole) {
      if (!roles.find(r => r.id === selectedRole.id)) {
        setSelectedRole(roles[0]);
      }
    }
  }, [isOpen, roles, selectedRole]);
  
  const permissionsBySubject = useMemo(() => {
    const sortedSubjects = Object.keys(
      allPermissions.reduce((acc, p) => {
        acc[p.subject] = true;
        return acc;
      }, {} as Record<string, boolean>)
    ).sort();

    const grouped: Record<string, Permission[]> = {};
    for (const subject of sortedSubjects) {
      grouped[subject] = allPermissions
        .filter(p => p.subject === subject)
        .sort((a, b) => a.action.localeCompare(b.action));
    }
    return grouped;
  }, [allPermissions]);


  const handlePermissionChange = (permissionId: number, isChecked: boolean) => {
    if (!selectedRole) return;
    
    setRolePermissions(prev => {
      const currentPerms = prev[selectedRole.id] || [];
      const newPerms = isChecked
        ? [...currentPerms, permissionId]
        : currentPerms.filter(id => id !== permissionId);
      return { ...prev, [selectedRole.id]: newPerms };
    });
  };

  const handleSaveChanges = async () => {
    if (!selectedRole) return;
    setSaving(true);
    
    const originalPerms = new Set(initialRolePermissions[selectedRole.id] || []);
    const newPerms = new Set(rolePermissions[selectedRole.id] || []);

    const permsToAdd = [...newPerms].filter(id => !originalPerms.has(id));
    const permsToRemove = [...originalPerms].filter(id => !newPerms.has(id));

    try {
      if (permsToRemove.length > 0) {
        const { error } = await supabase
          .from('rolepermissions')
          .delete()
          .eq('role_id', selectedRole.id)
          .in('permission_id', permsToRemove);
        if (error) throw error;
      }
      
      if (permsToAdd.length > 0) {
        const { error } = await supabase
          .from('rolepermissions')
          .insert(permsToAdd.map(permission_id => ({ role_id: selectedRole.id, permission_id })));
        if (error) throw error;
      }
      
      setInitialRolePermissions(prev => ({...prev, [selectedRole!.id]: [...newPerms]}));
      setSaveResultModalInfo({ title: "Éxito", message: "Los permisos se han guardado correctamente.", success: true });

    } catch (error: any) {
      console.error("Error saving permissions:", error);
      setSaveResultModalInfo({ title: "Error", message: `No se pudieron guardar los permisos: ${error.message}`, success: false });
    } finally {
      setSaving(false);
    }
  };
  
  const handleOpenRoleForm = (mode: 'create' | 'edit', role: Role | null = null) => {
    setRoleFormMode(mode);
    setRoleToManage(role);
    setRoleNameInput(role ? role.name : '');
  };

  const handleCloseRoleForm = () => {
    setRoleFormMode(null);
    setRoleToManage(null);
    setRoleNameInput('');
  };

  const handleRoleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleNameInput.trim()) {
      alert('El nombre del rol no puede estar vacío.');
      return;
    }
    setRoleFormSubmitting(true);
    try {
      if (roleFormMode === 'create') {
        const { data, error } = await supabase.from('roles').insert([{ name: roleNameInput.trim() }]).select().single();
        if (error) throw error;
        setSaveResultModalInfo({ title: "Éxito", message: "Rol creado con éxito.", success: true });
        onRolesUpdated();
        const newRole = data as Role;
        setRoles(prev => [...prev, newRole]);
        setSelectedRole(newRole);
      } else if (roleFormMode === 'edit' && roleToManage) {
        const { error } = await supabase.from('roles').update({ name: roleNameInput.trim() }).eq('id', roleToManage.id);
        if (error) throw error;
        setSaveResultModalInfo({ title: "Éxito", message: "Rol actualizado con éxito.", success: true });
        onRolesUpdated();
      }
      handleCloseRoleForm();
    } catch (error: any) {
      console.error('Error managing role:', error);
      setSaveResultModalInfo({ title: "Error", message: `No se pudo guardar el rol: ${error.message}`, success: false });
    } finally {
      setRoleFormSubmitting(false);
    }
  };

  const handleOpenDeleteConfirm = async (role: Role) => {
    setIsCheckingUsage(true);
    setRoleToDelete(role);
    try {
        const { count, error } = await supabase
            .from('userprofiles')
            .select('*', { count: 'exact', head: true })
            .eq('role_id', role.id);
        if (error) throw error;
        setUsersWithRoleCount(count || 0);
    } catch(error: any) {
        console.error("Error checking role usage:", error);
        setSaveResultModalInfo({ title: "Error", message: "No se pudo verificar el uso del rol.", success: false });
        setRoleToDelete(null);
    } finally {
        setIsCheckingUsage(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!roleToDelete || usersWithRoleCount > 0) return;
    try {
      const { error } = await supabase.from('roles').delete().eq('id', roleToDelete.id);
      if (error) throw error;
      setSaveResultModalInfo({ title: "Éxito", message: "Rol eliminado con éxito.", success: true });
      onRolesUpdated();
      setRoleToDelete(null);
    } catch (error: any) {
      console.error('Error deleting role:', error);
      setSaveResultModalInfo({ title: "Error", message: `No se pudo eliminar el rol: ${error.message}`, success: false });
    }
  };


  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title="Gestionar Roles y Permisos" size="xl">
      {loading ? (
        <div className="text-center p-8">Cargando datos de permisos...</div>
      ) : (
        <div className="flex flex-col md:flex-row gap-6 min-h-[60vh]">
          <div className="md:w-1/4 md:border-r md:dark:border-slate-700 md:pr-4">
             <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-lg">Roles</h3>
                {isSuperAdmin && (
                    <Button
                        variant="accent"
                        size="sm"
                        className="!p-1.5"
                        onClick={() => handleOpenRoleForm('create')}
                        aria-label="Crear nuevo rol"
                    >
                        <PlusIcon className="w-4 h-4" />
                    </Button>
                )}
            </div>
            <div className="bg-gray-50 dark:bg-slate-800/50 p-2 rounded-lg">
                <ul className="space-y-1">
                {roles.map(role => (
                    <li key={role.id}>
                      <div className="flex items-center justify-between group">
                        <button 
                            onClick={() => setSelectedRole(role)}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedRole?.id === role.id ? 'bg-primary-600 text-white font-semibold shadow' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'}`}
                        >
                            {role.name}
                        </button>
                        {isSuperAdmin && (
                            <div className="flex items-center pl-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="sm" variant="ghost" className="!p-1" onClick={() => handleOpenRoleForm('edit', role)} aria-label={`Editar rol ${role.name}`}><EditIcon className="w-4 h-4 text-accent" /></Button>
                                <Button size="sm" variant="ghost" className="!p-1" onClick={() => handleOpenDeleteConfirm(role)} aria-label={`Eliminar rol ${role.name}`}><TrashIcon className="w-4 h-4 text-red-500" /></Button>
                            </div>
                        )}
                      </div>
                    </li>
                ))}
                </ul>
            </div>
          </div>
          <div className="md:w-3/4">
            {selectedRole ? (
              <div>
                <h3 className="font-semibold mb-3 text-lg text-gray-800 dark:text-gray-200">
                    Permisos para <span className="text-primary-600 dark:text-primary-400 font-bold">{selectedRole.name}</span>
                </h3>
                <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                  {Object.entries(permissionsBySubject).map(([subject, permissions]) => (
                    <div key={subject} className="p-4 rounded-lg bg-gray-50 dark:bg-slate-800 border dark:border-slate-700">
                      <h4 className="font-semibold text-gray-700 dark:text-gray-200 border-b dark:border-slate-600 pb-2 mb-3">
                        {translate('subjects', subject)}
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                        {permissions.map(permission => (
                          <label key={permission.id} className="flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-gray-300 dark:border-slate-500 text-primary-600 focus:ring-primary-500 bg-white dark:bg-slate-900"
                              checked={rolePermissions[selectedRole.id]?.includes(permission.id) || false}
                              onChange={(e) => handlePermissionChange(permission.id, e.target.checked)}
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                              {translate('actions', permission.action)}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">Seleccione un rol para ver sus permisos.</div>
            )}
          </div>
        </div>
      )}
       <div className="flex justify-end space-x-3 pt-4 mt-4 border-t border-gray-200 dark:border-slate-700">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
          <Button variant="primary" onClick={handleSaveChanges} disabled={loading || saving || !selectedRole}>
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>
    </Modal>
    <Modal isOpen={!!roleFormMode} onClose={handleCloseRoleForm} title={roleFormMode === 'create' ? 'Crear Nuevo Rol' : 'Editar Rol'}>
        <form onSubmit={handleRoleFormSubmit} id="role-form" className="space-y-4">
            <Input
                label="Nombre del Rol"
                value={roleNameInput}
                onChange={(e) => setRoleNameInput(e.target.value)}
                required
                autoFocus
            />
        </form>
        <div className="flex justify-end space-x-3 pt-4 mt-4 border-t border-gray-200 dark:border-slate-700">
            <Button variant="secondary" onClick={handleCloseRoleForm}>Cancelar</Button>
            <Button variant="primary" type="submit" form="role-form" disabled={roleFormSubmitting}>
                {roleFormSubmitting ? 'Guardando...' : 'Guardar'}
            </Button>
        </div>
    </Modal>
     <Modal isOpen={!!roleToDelete} onClose={() => setRoleToDelete(null)} title="Confirmar Eliminación">
        {isCheckingUsage ? (
          <p>Verificando uso del rol...</p>
        ) : roleToDelete ? (
          <div className="text-sm">
            {usersWithRoleCount > 0 ? (
              <>
                <p className="font-semibold text-red-600 dark:text-red-400">No se puede eliminar el rol.</p>
                <p className="mt-2">
                  El rol <strong>"{roleToDelete.name}"</strong> está asignado a <strong>{usersWithRoleCount}</strong> usuario(s).
                  Debe reasignar estos usuarios a otro rol antes de poder eliminar este.
                </p>
                <div className="flex justify-end mt-6">
                    <Button variant="secondary" onClick={() => setRoleToDelete(null)}>Entendido</Button>
                </div>
              </>
            ) : (
              <>
                <p>¿Está seguro de que desea eliminar el rol <strong>"{roleToDelete.name}"</strong>?</p>
                <p className="mt-2 text-xs text-gray-500">Esta acción no se puede deshacer.</p>
                <div className="flex justify-end mt-6 space-x-2">
                    <Button variant="secondary" onClick={() => setRoleToDelete(null)}>Cancelar</Button>
                    <Button variant="danger" onClick={handleConfirmDelete}>Sí, Eliminar</Button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </Modal>
      <Modal 
        isOpen={!!saveResultModalInfo} 
        onClose={() => setSaveResultModalInfo(null)} 
        title={saveResultModalInfo?.title || 'Notificación'}
      >
        <p className={saveResultModalInfo?.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
          {saveResultModalInfo?.message}
        </p>
        <div className="flex justify-end mt-6">
          <Button variant="primary" onClick={() => setSaveResultModalInfo(null)}>
            Aceptar
          </Button>
        </div>
      </Modal>
    </>
  );
};


const AdminUsersView: React.FC<AdminUsersViewProps> = ({ onNavigateBack, users, roles, onUpdate }) => {
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{type: 'success' | 'error', content: string} | null>(null);
  const { profile } = useAuth();

  const handleApproveUser = useCallback(async (userId: string) => {
    const { error } = await supabase
      .from('userprofiles')
      .update({ is_approved: true })
      .eq('id', userId);
    
    if (error) alert(`Error al aprobar usuario: ${error.message}`);
    else onUpdate();
  }, [onUpdate]);

  const handleRoleChange = useCallback(async (userId: string, newRoleId: string) => {
    const { error } = await supabase
      .from('userprofiles')
      .update({ role_id: newRoleId ? parseInt(newRoleId, 10) : null })
      .eq('id', userId);

    if (error) alert(`Error al cambiar el rol: ${error.message}`);
    else onUpdate();
  }, [onUpdate]);
  
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteMessage(null);
    try {
      const { error } = await supabase.functions.invoke('invite-user', {
        body: { email: inviteEmail },
      });
      if (error) throw error;
      setInviteMessage({ type: 'success', content: `Invitación enviada con éxito a ${inviteEmail}.`});
      setInviteEmail('');
      setTimeout(() => setIsInviteModalOpen(false), 2000);
    } catch (err: any) {
      setInviteMessage({type: 'error', content: `Error al enviar invitación: ${err.message}`});
    } finally {
      setInviteLoading(false);
    }
  };
  
  const roleOptions = [{ value: '', label: 'Sin Rol' }, ...roles.map(r => ({ value: r.id.toString(), label: r.name }))];

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Gestionar Usuarios</h1>
        <div className="flex items-center gap-2">
            <Button onClick={() => setIsInviteModalOpen(true)} variant="primary">Invitar Usuario</Button>
            <Button onClick={() => setIsPermissionsModalOpen(true)} variant="secondary">Gestionar Permisos</Button>
            {onNavigateBack && <Button onClick={onNavigateBack} variant="secondary">Volver al Menú</Button>}
        </div>
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
                         className="w-full max-w-[200px]"
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
                          size="md"
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
      <ManagePermissionsModal 
        isOpen={isPermissionsModalOpen} 
        onClose={() => setIsPermissionsModalOpen(false)}
        roles={roles}
        profile={profile}
        onRolesUpdated={onUpdate}
      />
      <Modal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} title="Invitar Nuevo Usuario">
        <form onSubmit={handleInviteUser} id="invite-form" className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
                Se enviará un correo electrónico al usuario con un enlace para que establezca su contraseña y acceda a la plataforma. La cuenta deberá ser aprobada después del registro.
            </p>
            <Input
                label="Correo Electrónico del Invitado"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                autoFocus
                placeholder="nuevo.usuario@ejemplo.com"
            />
            {inviteMessage && (
                <p className={`text-sm ${inviteMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {inviteMessage.content}
                </p>
            )}
        </form>
        <div className="flex justify-end space-x-3 pt-4 mt-4 border-t border-gray-200 dark:border-slate-700">
          <Button variant="secondary" onClick={() => setIsInviteModalOpen(false)}>Cancelar</Button>
          <Button variant="primary" type="submit" form="invite-form" disabled={inviteLoading}>
            {inviteLoading ? 'Enviando...' : 'Enviar Invitación'}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default AdminUsersView;
