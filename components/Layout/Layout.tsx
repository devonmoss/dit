import React, { ReactNode } from 'react';
import Head from 'next/head';
import TopMenu from '../TopMenu/TopMenu';
import AuthPanel from '../AuthPanel/AuthPanel';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  title = 'Continuous Wave' 
}) => {
  return (
    <div className={styles.container}>
      <Head>
        <title>{title}</title>
        <meta name="description" content="The best way to learn Morse code" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <AuthPanel />
        <TopMenu />
        <div className={styles.content}>
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout; 