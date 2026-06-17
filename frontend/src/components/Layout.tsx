import { useState } from 'react'
import { Layout as AntLayout, Menu, theme } from 'antd'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  FileAddOutlined,
  AuditOutlined,
  UserOutlined,
  BarChartOutlined,
} from '@ant-design/icons'

const { Header, Sider, Content } = AntLayout

const Layout = () => {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const menuItems = [
    {
      key: '/request',
      icon: <FileAddOutlined />,
      label: '护士需求提交',
    },
    {
      key: '/assign',
      icon: <AuditOutlined />,
      label: '主管派单',
    },
    {
      key: '/accept',
      icon: <UserOutlined />,
      label: '陪检员接单',
    },
    {
      key: '/settle',
      icon: <BarChartOutlined />,
      label: '结算统计',
    },
  ]

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value) => setCollapsed(value)}
      >
        <div
          style={{
            height: 64,
            margin: 16,
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: collapsed ? 14 : 18,
            fontWeight: 'bold',
          }}
        >
          {collapsed ? '陪检' : '医院陪检管理系统'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[location.pathname]}
          mode="inline"
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <AntLayout>
        <Header
          style={{
            padding: '0 24px',
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <h2 style={{ margin: 0 }}>医院陪检管理系统</h2>
        </Header>
        <Content style={{ margin: '16px' }}>
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Outlet />
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  )
}

export default Layout

